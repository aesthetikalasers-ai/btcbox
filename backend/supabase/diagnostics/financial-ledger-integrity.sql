-- BTCBOX read-only financial ledger integrity diagnostics v2.
-- SELECT-only. Run in a restricted operations/staging session after migrations.
-- A spot_trade is one fill and intentionally has FOUR ledger legs (two users x
-- two assets). Do not interpret it as a one-row financial operation.
-- An empty result is necessary but not sufficient evidence for cutover.

with
ledger_totals as (
  select user_id, asset,
         sum(available_delta) as available_delta_total,
         sum(frozen_delta) as frozen_delta_total
    from public.financial_ledger
   group by user_id, asset
),
latest_ledger as (
  select distinct on (user_id, asset)
         user_id, asset, available_after, frozen_after, id
    from public.financial_ledger
   order by user_id, asset, id desc
),
ledger_chain as (
  select id, user_id, asset, available_delta, frozen_delta,
         available_after, frozen_after,
         lag(available_after) over (partition by user_id, asset order by id) as prior_available_after,
         lag(frozen_after) over (partition by user_id, asset order by id) as prior_frozen_after
    from public.financial_ledger
),
operation_ledger as (
  select o.id, o.user_id, o.asset, o.operation_type,
         count(l.id) as ledger_rows,
         count(distinct l.user_id) as ledger_users,
         count(distinct l.asset) as ledger_assets,
         coalesce(sum(l.available_delta + l.frozen_delta),0) as net_delta
    from public.financial_operations o
    left join public.financial_ledger l on l.operation_id = o.id
   group by o.id, o.user_id, o.asset, o.operation_type
),
spot_trade_shape as (
  select t.operation_id, t.pair_key, t.base_asset, t.quote_asset,
         t.buyer_user_id, t.seller_user_id, t.quantity, t.quote_amount,
         count(l.id) as ledger_rows,
         count(distinct l.user_id) as ledger_users,
         count(distinct l.asset) as ledger_assets,
         count(*) filter (
           where l.user_id=t.buyer_user_id and l.asset=t.base_asset
             and l.available_delta=t.quantity and l.frozen_delta=0
         ) as buyer_base_legs,
         count(*) filter (
           where l.user_id=t.seller_user_id and l.asset=t.base_asset
             and l.available_delta=0 and l.frozen_delta=-t.quantity
         ) as seller_base_legs,
         count(*) filter (
           where l.user_id=t.buyer_user_id and l.asset=t.quote_asset
             and l.frozen_delta < 0
         ) as buyer_quote_legs,
         count(*) filter (
           where l.user_id=t.seller_user_id and l.asset=t.quote_asset
             and l.available_delta=t.quote_amount and l.frozen_delta=0
         ) as seller_quote_legs,
         coalesce(sum(l.available_delta+l.frozen_delta)
           filter (where l.asset=t.base_asset),0) as base_net_delta,
         coalesce(sum(l.available_delta+l.frozen_delta)
           filter (where l.asset=t.quote_asset),0) as quote_net_delta,
         coalesce(sum(l.available_delta+l.frozen_delta)
           filter (where l.user_id=t.buyer_user_id and l.asset=t.quote_asset),0) as buyer_quote_net_delta
    from public.financial_matching_trades t
    left join public.financial_ledger l on l.operation_id=t.operation_id
   group by t.operation_id,t.pair_key,t.base_asset,t.quote_asset,
            t.buyer_user_id,t.seller_user_id,t.quantity,t.quote_amount
),
pending_withdrawals as (
  select user_id, asset, sum(amount + fee) as pending_hold_total
    from public.withdrawal_requests
   where status in ('pending','pending_admin_review','approved','broadcast')
   group by user_id, asset
),
findings as (
  select 'account_delta_total_mismatch'::text as finding,
         a.user_id::text as user_id, a.asset::text as asset,
         null::text as object_id,
         coalesce(t.available_delta_total,0)::text || '/' || coalesce(t.frozen_delta_total,0)::text as expected,
         a.available::text || '/' || a.frozen::text as actual
    from public.financial_accounts a
    left join ledger_totals t using (user_id,asset)
   where a.available <> coalesce(t.available_delta_total,0)
      or a.frozen <> coalesce(t.frozen_delta_total,0)

  union all
  select 'account_latest_snapshot_mismatch',a.user_id,a.asset,null,
         coalesce(l.available_after,0)::text || '/' || coalesce(l.frozen_after,0)::text,
         a.available::text || '/' || a.frozen::text
    from public.financial_accounts a
    left join latest_ledger l using (user_id,asset)
   where a.available <> coalesce(l.available_after,0)
      or a.frozen <> coalesce(l.frozen_after,0)

  union all
  select 'ledger_chain_discontinuity',c.user_id,c.asset,c.id::text,
         c.prior_available_after::text || '/' || c.prior_frozen_after::text,
         (c.available_after-c.available_delta)::text || '/' || (c.frozen_after-c.frozen_delta)::text
    from ledger_chain c
   where c.prior_available_after is not null
     and (c.prior_available_after <> c.available_after-c.available_delta
       or c.prior_frozen_after <> c.frozen_after-c.frozen_delta)

  union all
  select 'operation_without_ledger',o.user_id,o.asset,o.id::text,
         case when o.operation_type='spot_trade' then 'exactly 4 ledger rows' else 'at least 1 ledger row' end,
         o.ledger_rows::text
    from operation_ledger o
   where o.ledger_rows=0
      or (o.operation_type='spot_trade' and o.ledger_rows<>4)

  union all
  select 'operation_identity_mismatch',o.user_id,o.asset,o.id::text,
         o.user_id || '/' || o.asset,
         coalesce(min(l.user_id),'<missing>') || '/' || coalesce(min(l.asset),'<missing>')
    from operation_ledger o
    join public.financial_ledger l on l.operation_id=o.id
   where o.operation_type not in ('spot_trade','perp_trade','perp_liquidation','perp_insurance_cover','perp_bad_debt')
   group by o.id,o.user_id,o.asset
  having count(l.id)=1
     and (min(l.user_id)<>o.user_id or min(l.asset)<>o.asset)

  union all
  select 'spot_trade_four_leg_mismatch',s.buyer_user_id,s.base_asset,s.operation_id::text,
         '4 legs; 2 users; 2 assets; base/quote net zero',
         s.ledger_rows::text || ' legs/' || s.ledger_users::text || ' users/' ||
         s.ledger_assets::text || ' assets; buyerBase=' || s.buyer_base_legs::text ||
         '; sellerBase=' || s.seller_base_legs::text || '; buyerQuote=' ||
         s.buyer_quote_legs::text || '; sellerQuote=' || s.seller_quote_legs::text ||
         '; baseNet=' || s.base_net_delta::text || '; quoteNet=' || s.quote_net_delta::text ||
         '; buyerQuoteNet=' || s.buyer_quote_net_delta::text
    from spot_trade_shape s
   where s.ledger_rows<>4 or s.ledger_users<>2 or s.ledger_assets<>2
      or s.buyer_base_legs<>1 or s.seller_base_legs<>1
      or s.buyer_quote_legs<>1 or s.seller_quote_legs<>1
      or s.base_net_delta<>0 or s.quote_net_delta<>0
      or s.buyer_quote_net_delta<>-s.quote_amount

  union all
  select 'spot_trade_missing_trade_record',o.user_id,o.asset,o.id::text,
         'one financial_matching_trades row','0'
    from operation_ledger o
    left join public.financial_matching_trades t on t.operation_id=o.id
   where o.operation_type='spot_trade' and t.operation_id is null

  union all
  select 'pending_withdrawal_hold_shortfall',p.user_id,p.asset,null,
         p.pending_hold_total::text,coalesce(a.frozen,0)::text
    from pending_withdrawals p
    left join public.financial_accounts a using (user_id,asset)
   where coalesce(a.frozen,0)<p.pending_hold_total

  union all
  select 'withdrawal_missing_freeze_operation',w.user_id,w.asset,w.id,
         'freeze operation linked',coalesce(w.freeze_operation_id::text,'<null>')
    from public.withdrawal_requests w
   where w.freeze_operation_id is null

  union all
  select 'approved_withdrawal_review_not_original_freeze',w.user_id,w.asset,w.id,
         w.freeze_operation_id::text,coalesce(w.review_operation_id::text,'<null>')
    from public.withdrawal_requests w
   where w.status='approved'
     and (w.freeze_operation_id is null or w.review_operation_id is distinct from w.freeze_operation_id)

  union all
  select 'reviewed_withdrawal_missing_review_operation',w.user_id,w.asset,w.id,
         'review operation linked',coalesce(w.review_operation_id::text,'<null>')
    from public.withdrawal_requests w
   where w.status in ('rejected','broadcast','failed','completed')
     and w.review_operation_id is null

  union all
  select 'completed_withdrawal_missing_payout_operation',w.user_id,w.asset,w.id,
         'payout operation linked',coalesce(w.payout_operation_id::text,'<null>')
    from public.withdrawal_requests w
   where w.status='completed' and w.payout_operation_id is null

  union all
  select 'completed_withdrawal_payout_operation_mismatch',w.user_id,w.asset,w.id,
         'withdraw_paid or legacy withdraw_settle',
         coalesce(o.operation_type,'<missing>')
    from public.withdrawal_requests w
    left join public.financial_operations o on o.id=w.payout_operation_id
   where w.status='completed'
     and (o.id is null or o.operation_type not in ('withdraw_paid','withdraw_settle')
       or o.user_id<>w.user_id or o.asset<>w.asset)

  union all
  select 'confirmed_deposit_missing_credit_operation',d.user_id,d.asset,d.id,
         'credit operation linked',coalesce(d.credit_operation_id::text,'<null>')
    from public.deposit_records d
   where d.status='confirmed' and d.credit_operation_id is null

  union all
  select 'redeemed_position_missing_redeem_operation',e.user_id,e.asset,e.id,
         'redeem operation linked',coalesce(e.redeem_operation_id::text,'<null>')
    from public.earn_positions e
   where e.status='redeemed' and e.redeem_operation_id is null
)
select finding,user_id,asset,object_id,expected,actual
  from findings
 order by finding,user_id,asset,object_id;
