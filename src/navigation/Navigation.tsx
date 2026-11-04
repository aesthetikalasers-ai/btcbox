import { Routes, Route } from 'react-router-dom';
// pages
import MarketScreen from '../screens/Market/MarketScreen';
import SigninScreen from '../screens/Members/SigninScreen';
import SignupScreen from '../screens/Members/SignupScreen';
import ForgotScreen from '../screens/Members/ForgotScreen';
import ProfileScreen from '../screens/Members/ProfileScreen';
import CapitalScreen from '../screens/Capital/CapitalScreen';
import NotFoundScreen from '../screens/NotFound/NotFoundScreen';
import DashboardScreen from '../screens/Dashboard/DashboardScreen';
import TransactionsScreen from '../screens/Transactions/TransactionsScreen';
import LandingScreen from '../screens/Landing/LandingScreen';
import InfoScreen from '../screens/Info/InfoScreen';

const Navigation: React.FC = () => (
  <Routes>
    <Route path='/' element={<LandingScreen />} />
    <Route path='/signin' element={<SigninScreen />} />
    <Route path='/members/signup' element={<SignupScreen />} />
    <Route path='/members/forgot-password' element={<ForgotScreen />} />
    <Route path='/market' element={<MarketScreen />} />
    <Route path='/search' element={<MarketScreen />} />
    <Route path='/capital' element={<CapitalScreen />} />
    <Route path='/wallet' element={<CapitalScreen />} />
    <Route path='/transactions' element={<TransactionsScreen />} />
    <Route path='/dashboard' element={<DashboardScreen />} />
    <Route path='/members' element={<ProfileScreen />} />
    <Route
      path='/members/notifications'
      element={<InfoScreen title='Notifications' description='You have no new notifications.' />}
    />
    <Route
      path='/settings'
      element={
        <InfoScreen
          title='Settings'
          description='Account settings, security preferences and API management will appear here.'
        />
      }
    />
    <Route
      path='/contacts'
      element={
        <InfoScreen
          title='Addresses'
          description='Saved withdrawal addresses and whitelisted contacts will appear here.'
        />
      }
    />
    <Route
      path='/messages'
      element={<InfoScreen title='Messages' description='Secure messages from BTCBOX support.' />}
    />
    <Route path='*' element={<NotFoundScreen />} />
  </Routes>
);

export default Navigation;
