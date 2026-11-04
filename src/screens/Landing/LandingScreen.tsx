import { Link } from 'react-router-dom';
// components
import MainLayout from '../../layouts/MainLayout';

const features = [
  {
    icon: 'security',
    title: 'Bank-grade security',
    desc: 'Cold storage, multi-signature wallets and 2FA protect your assets around the clock.',
  },
  {
    icon: 'speed',
    title: 'Deep liquidity',
    desc: 'Tight spreads and fast order matching across hundreds of spot trading pairs.',
  },
  {
    icon: 'public',
    title: 'Global access',
    desc: 'Trade from anywhere with instant USD, EUR and crypto deposit and withdrawal.',
  },
  {
    icon: 'support_agent',
    title: '24/7 support',
    desc: 'Our expert team is ready to help you any time, any day.',
  },
];

const markets = [
  { pair: 'BTC/USDT', price: '67,842.10', change: '+2.34%', up: true },
  { pair: 'ETH/USDT', price: '3,521.88', change: '+1.12%', up: true },
  { pair: 'XRP/USDT', price: '0.5821', change: '-0.87%', up: false },
  { pair: 'SOL/USDT', price: '168.45', change: '+5.61%', up: true },
];

const LandingScreen: React.FC = () => (
  <MainLayout>
    <div className='landing'>
      <header className='landing-header'>
        <Link to='/' className='landing-brand'>
          <img
            draggable='false'
            alt='BTCBOX'
            src={`${process.env.PUBLIC_URL}/images/logo-white.png`}
            className='landing-logo'
          />
        </Link>
        <nav className='landing-nav'>
          <Link to='/market'>Markets</Link>
          <Link to='/signin' className='button button-green button-small'>
            Sign in
          </Link>
          <Link to='/members/signup' className='button button-outline button-small'>
            Sign up
          </Link>
        </nav>
      </header>

      <section className='landing-hero'>
        <div className='landing-hero-text'>
          <h1>
            Trade crypto on <span className='accent'>BTCBOX</span>
          </h1>
          <p className='landing-slogan'>Secure Crypto Exchange</p>
          <p className='landing-sub'>
            Buy, sell and hold Bitcoin, Ethereum and hundreds of digital assets with confidence.
          </p>
          <div className='landing-cta'>
            <Link to='/members/signup' className='button button-green button-large'>
              Start trading
            </Link>
            <Link to='/market' className='button button-outline button-large'>
              View markets
            </Link>
          </div>
        </div>

        <div className='landing-ticker box'>
          <div className='box-title box-vertical-padding box-horizontal-padding'>
            <p>Popular markets</p>
          </div>
          <div className='box-content'>
            {markets.map((m) => (
              <div key={m.pair} className='landing-ticker-row'>
                <span className='pair'>{m.pair}</span>
                <span className='price'>{m.price}</span>
                <span className={m.up ? 'change up' : 'change down'}>{m.change}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className='landing-features'>
        {features.map((f) => (
          <div key={f.title} className='box landing-feature'>
            <i className='material-icons landing-feature-icon'>{f.icon}</i>
            <h3>{f.title}</h3>
            <p>{f.desc}</p>
          </div>
        ))}
      </section>

      <footer className='landing-footer'>
        <img
          draggable='false'
          alt='BTCBOX'
          src={`${process.env.PUBLIC_URL}/images/logo-white.png`}
          className='landing-footer-logo'
        />
        <p>Secure Crypto Exchange &copy; {new Date().getFullYear()} BTCBOX. All rights reserved.</p>
      </footer>
    </div>
  </MainLayout>
);

export default LandingScreen;
