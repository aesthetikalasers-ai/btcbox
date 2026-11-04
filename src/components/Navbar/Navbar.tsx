import { Link } from 'react-router-dom';
// components
import NavbarButton from './NavbarButton';

const Navbar: React.FC = () => (
  <nav className='navbar-inner no-select'>
    <div className='logo'>
      <Link to='/'>
        <img
          draggable='false'
          alt='BTCBOX — Secure Crypto Exchange'
          src={`${process.env.PUBLIC_URL}/images/logo-white.png`}
        />
      </Link>
    </div>
    <h3>Main menu</h3>
    <ul>
      <li>
        <NavbarButton url='/market' icon='show_chart' title='Markets' />
      </li>
      <li>
        <NavbarButton url='/capital' icon='account_balance_wallet' title='Assets / Wallet' />
      </li>
      <li>
        <NavbarButton url='/transactions' icon='history' title='Orders & History' />
      </li>
      <li>
        <NavbarButton url='/dashboard' icon='account_balance' title='Deposit / Withdraw' />
      </li>
    </ul>
    <h3>Account</h3>
    <ul>
      <li>
        <NavbarButton url='/members' icon='account_circle' title='My Profile' />
      </li>
      <li>
        <NavbarButton url='/settings' icon='settings' title='Settings' />
      </li>
      <li>
        <NavbarButton url='/contacts' icon='contacts' title='Addresses' />
      </li>
      <li>
        <NavbarButton url='/messages' icon='chat' title='Messages' />
      </li>
    </ul>
    <div className='copyright'>
      <strong>BTCBOX</strong>
      <p>
        Secure Crypto Exchange
        <br />
        {new Date().getFullYear()} &copy; All rights reserved.
      </p>
    </div>
  </nav>
);

export default Navbar;
