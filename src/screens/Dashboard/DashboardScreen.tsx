// components
import Box from '../../components/Common/Box';
import SiteLayout from '../../layouts/SiteLayout';
import Header from '../../components/Header/Header';
import BankProcess from '../../components/Widgets/BankProcess/BankProcess';
import RecentActivity from '../../components/Widgets/RecentActivity/RecentActivity';

const DashboardScreen: React.FC = () => (
  <SiteLayout>
    <Header icon='sort' title='Deposit / Withdraw' />
    <div className='flex flex-destroy flex-space-between'>
      <div className='flex-1 box-right-padding'>
        <BankProcess />
      </div>
      <div className='flex-1'>
        <Box>
          <div className='box-title box-vertical-padding box-horizontal-padding no-select'>
            <div className='flex flex-center flex-space-between'>
              <p>Deposit information</p>
            </div>
          </div>
          <div className='box-content box-text box-horizontal-padding box-content-height-nobutton'>
            <p>&bull; The recipient / beneficiary field must include "BTCBOX".</p>
            <p>
              &bull; You may send wire transfers from any bank account opened in your own name.
              Transfers from third-party accounts cannot be accepted.
            </p>
            <p>
              &bull; Cash deposits and ATM transfers without identifiable sender details cannot be
              processed.
            </p>
            <p>
              &bull; Funds are automatically credited to your account after verification. No
              separate notification is required.
            </p>
            <p>
              &bull; Identity-verified users do not need to include a fixed deposit code in the
              transfer description.
            </p>
          </div>
        </Box>
      </div>
    </div>

    <div className='flex flex-destroy flex-space-between'>
      <div className='flex-1 box-right-padding'>
        <RecentActivity />
      </div>
      <div className='flex-1'>
        <Box>
          <div className='box-title box-vertical-padding box-horizontal-padding no-select'>
            <div className='flex flex-center flex-space-between'>
              <p>Withdrawal information</p>
            </div>
          </div>
          <div className='box-content box-text box-horizontal-padding box-content-height-nobutton'>
            <p>
              &bull; Withdrawals can only be sent to bank accounts opened in your own name.
              Third-party transfers are not permitted.
            </p>
            <p>&bull; The minimum withdrawal amount is 10 USD.</p>
            <p>&bull; A processing fee of 3 USD applies to each withdrawal.</p>
            <p>
              &bull; When you submit a withdrawal request, the amount is immediately deducted from
              your available balance.
            </p>
            <p>
              &bull; You may cancel any request that has not yet been processed. Cancelled amounts
              are returned to your available balance.
            </p>
            <p>
              &bull; Requests submitted outside bank business hours are processed on the next
              business day.
            </p>
          </div>
        </Box>
      </div>
    </div>
  </SiteLayout>
);

export default DashboardScreen;
