import { Link } from 'react-router-dom';
// components
import Box from '../../components/Common/Box';
import SiteLayout from '../../layouts/SiteLayout';
import Header from '../../components/Header/Header';

// interfaces
interface IProps {
  title: string;
  description?: string;
}

const InfoScreen: React.FC<IProps> = ({ title, description }) => (
  <SiteLayout>
    <Header icon='info' title={title} />
    <Box>
      <div className='box-content box-text box-vertical-padding box-horizontal-padding center'>
        <i className='material-icons info-icon'>construction</i>
        <h2 className='info-title'>{title}</h2>
        <p>
          {description ||
            'This section is being prepared for the BTCBOX white-label release. It will be available soon.'}
        </p>
        <p>
          In the meantime, you can return to the{' '}
          <Link to='/market'>markets</Link> or check your <Link to='/capital'>wallet</Link>.
        </p>
      </div>
    </Box>
  </SiteLayout>
);

export default InfoScreen;
