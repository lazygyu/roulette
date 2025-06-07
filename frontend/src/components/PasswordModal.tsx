import React, { useEffect } from 'react';

interface PasswordModalProps {
  show: boolean;
  passwordInput: string;
  onPasswordInputChange: (value: string) => void;
  onJoin: () => void;
  joinError: string | null;
  passwordInputRef: React.RefObject<HTMLInputElement | null>;
}

const PasswordModal: React.FC<PasswordModalProps> = ({
  show,
  passwordInput,
  onPasswordInputChange,
  onJoin,
  joinError,
  passwordInputRef,
}) => {
  useEffect(() => {
    if (show && passwordInputRef.current) {
      passwordInputRef.current.focus();
    }
  }, [show, passwordInputRef]);

  if (!show) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 2000,
      }}
    >
      <div
        style={{
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '8px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          color: 'black',
        }}
      >
        <h3>Enter Room Password</h3>
        <input
          ref={passwordInputRef}
          type="password"
          value={passwordInput}
          onChange={(e) => onPasswordInputChange(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === 'Enter') onJoin();
          }}
          style={{ marginRight: '10px', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
        />
        <button
          onClick={onJoin}
          style={{
            padding: '8px 12px',
            borderRadius: '4px',
            border: 'none',
            backgroundColor: '#007bff',
            color: 'white',
            cursor: 'pointer',
          }}
        >
          Join
        </button>
        {joinError && <p style={{ color: 'red', marginTop: '10px' }}>{joinError}</p>}
      </div>
    </div>
  );
};

export default PasswordModal;
