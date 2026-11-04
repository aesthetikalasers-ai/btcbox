import { Link, useLocation } from 'react-router-dom';

const HeaderRight: React.FC = () => {
  const location = useLocation();
  return (
    <div className='header-right no-select'>
      <div className='flex flex-center'>
        <ul className='header-menu nowrap'>
          <li>
            <Link
              to='/market'
              className={location.pathname.toLowerCase().includes('/market') ? 'active' : 'passive'}
            >
              Markets
            </Link>
          </li>
          <li>
            <Link
              to='/capital'
              className={location.pathname.toLowerCase().includes('/capital') ? 'active' : 'passive'}
            >
              Wallet
            </Link>
          </li>
          <li>
            <Link
              to='/transactions'
              className={
                location.pathname.toLowerCase().includes('/transactions') ? 'active' : 'passive'
              }
            >
              Orders
            </Link>
          </li>
          <li>
            <Link
              to='/dashboard'
              className={
                location.pathname.toLowerCase().includes('/dashboard') ? 'active' : 'passive'
              }
            >
              Deposit
            </Link>
          </li>
        </ul>
        <ul className='header-icons nowrap'>
          <li>
            <Link to='/market' aria-label='Search markets'>
              <i className='material-icons'>search</i>
            </Link>
          </li>
          <li>
            <Link to='/members/notifications' aria-label='Notifications'>
              <span className='notification-badge'>3</span>
              <i className='material-icons'>notifications</i>
            </Link>
          </li>
        </ul>
        <ul className='header-user nowrap'>
          <li>
            <Link to='/members'>
              <span>BTCBOX Trader</span>
              <span>@btcbox_trader</span>
            </Link>
          </li>
          <li>
            <Link to='/members'>
              <div
                className='profile-picture cover'
                style={{
                  backgroundImage: `url('${process.env.PUBLIC_URL}/images/logo-icon.png')`,
                }}
              />
            </Link>
          </li>
          <li className='responsive-hide'>
            <Link to='/' className='signout' aria-label='Sign out'>
              <i className='material-icons'>power_settings_new</i>
            </Link>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default HeaderRight;
