import { useState, useEffect } from 'react';
// components
import Box from '../../Common/Box';

// interfaces
interface IBankDetails {
  id: number;
  name: string;
  account: string;
  swift: string;
  branch: string;
}

// variables — generic international wire-transfer details (demo data)
const dataArray: IBankDetails[] = [
  {
    id: 1,
    name: 'BTCBOX Primary Account',
    branch: 'Corporate Banking',
    account: 'US12 3456 7890 1234 5678 9012',
    swift: 'BTCXUS33',
  },
  {
    id: 2,
    name: 'BTCBOX USD Account',
    branch: 'Corporate Banking',
    account: 'US34 5678 9012 3456 7890 1234',
    swift: 'BTCXUS33',
  },
  {
    id: 3,
    name: 'BTCBOX EUR Account',
    branch: 'Corporate Banking',
    account: 'DE56 7890 1234 5678 9012 34',
    swift: 'BTCXDEFF',
  },
];

const BankProcess: React.FC = () => {
  const [tab, setTab] = useState<number>(0);
  const [bankDetails, setBankDetails] = useState<IBankDetails[]>([]);
  const [selectedBank, setSelectedBank] = useState<IBankDetails | null>(null);

  useEffect(() => {
    setBankDetails(dataArray);
    setSelectedBank(dataArray[0]);
  }, []);

  /**
   * Handles the change event for the account selection dropdown.
   *
   * @param {React.ChangeEvent<HTMLSelectElement>} e - The change event object.
   */
  const handleViewOnChange = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    e.preventDefault();
    const { value } = e.target;
    const findBank = bankDetails.find((item: IBankDetails) => item.id === +value);
    if (findBank) {
      setSelectedBank(findBank);
    }
  };

  return (
    <Box>
      <div className='box-title box-vertical-padding box-horizontal-padding no-select'>
        <div className='flex flex-center flex-space-between'>
          <div>
            <p>Deposit / Withdraw</p>
          </div>
          <ul>
            <li>
              <button
                type='button'
                onClick={() => setTab(0)}
                className={tab === 0 ? 'active' : 'passive'}
              >
                Deposit
              </button>
            </li>
            <li>
              <button
                type='button'
                onClick={() => setTab(1)}
                className={tab === 1 ? 'active' : 'passive'}
              >
                Withdraw
              </button>
            </li>
          </ul>
        </div>
      </div>

      {tab === 0 && (
        <div className='box-content box-horizontal-padding box-vertical-padding box-content-height-nobutton'>
          <form noValidate className='form'>
            <div className='form-elements'>
              <div className='form-line'>
                <div className='full-width'>
                  <label htmlFor='view'>Select account</label>
                  <select name='view' id='view' onChange={handleViewOnChange}>
                    {bankDetails &&
                      bankDetails.map((item: IBankDetails) => (
                        <option key={item.id.toString()} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            </div>
          </form>
          <div className='box-text flex flex-center flex-space-between'>
            {selectedBank && (
              <>
                <div className='bank-info box-horizontal-padding'>
                  <p>
                    <strong>
                      {selectedBank.name} — {selectedBank.branch}
                    </strong>
                    <br />
                    Account / IBAN: {selectedBank.account}
                    <br />
                    SWIFT / BIC: {selectedBank.swift}
                    <br />
                    Beneficiary: BTCBOX LTD
                  </p>
                </div>
                <button type='button' className='pointer red no-select' aria-label='Copy'>
                  <i className='material-icons'>content_copy</i>
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {tab === 1 && (
        <div className='box-content box-horizontal-padding box-vertical-padding box-content-height-nobutton'>
          <form noValidate className='form'>
            <div className='form-elements'>
              <div className='form-line'>
                <div className='full-width'>
                  <label htmlFor='iban'>Add bank account</label>
                  <input
                    type='text'
                    name='iban'
                    id='iban'
                    placeholder='Enter account / IBAN number'
                  />
                </div>
              </div>
            </div>
          </form>
          <form noValidate className='form'>
            <div className='form-elements'>
              <div className='form-line'>
                <div className='full-width'>
                  <label htmlFor='saved'>Saved accounts</label>
                  <select name='saved' id='saved'>
                    <option value='1'>BTCBOX Primary Account</option>
                  </select>
                </div>
              </div>
            </div>
          </form>
          <div className='box-text box-horizontal-padding center'>
            <p>
              <strong>US12 3456 7890 1234 5678 9012</strong>
            </p>
            <p>
              <span>Withdrawal amount: </span>
              <strong>2,376.00 USD</strong>
            </p>
          </div>
          <button type='button' className='button button-green button-medium button-block'>
            Withdraw
          </button>
        </div>
      )}
    </Box>
  );
};

export default BankProcess;
