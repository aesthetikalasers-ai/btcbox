import { Link } from 'react-router-dom';

// interfaces
interface IProps {
  icon?: string;
  title: string;
}

const HeaderLeft: React.FC<IProps> = ({ icon, title }) => (
  <div className='header-left nowrap no-select'>
    <Link to='/' className='mobile-logo' aria-label='BTCBOX home'>
      <img
        draggable='false'
        alt='BTCBOX'
        src={`${process.env.PUBLIC_URL}/images/logo-icon.png`}
      />
    </Link>
    {icon && (
      <button type='button' className='pointer'>
        <i className='material-icons'>{icon}</i>
      </button>
    )}
    <h1>{title}</h1>
  </div>
);

export default HeaderLeft;
