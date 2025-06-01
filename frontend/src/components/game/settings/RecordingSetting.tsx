import React, { FC } from 'react';

interface RecordingSettingProps {
  autoRecording: boolean;
  onAutoRecordingChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  disabled: boolean;
}

const RecordingSetting: FC<RecordingSettingProps> = ({ autoRecording, onAutoRecordingChange, disabled }) => {
  return (
    <div className="row">
      <label htmlFor="chkAutoRecording">
        <i className="icon record"></i>
        <span data-trans>Recording</span>
      </label>
      <input
        type="checkbox"
        id="chkAutoRecording"
        checked={autoRecording}
        onChange={onAutoRecordingChange}
        disabled={disabled}
      />
    </div>
  );
};

export default RecordingSetting;
