import React, { FC } from 'react';

interface NamesInputProps {
  namesInput: string;
  onNamesInput: (event: React.FormEvent<HTMLTextAreaElement>) => void;
  onNamesBlur: (event: React.FocusEvent<HTMLTextAreaElement>) => void;
  disabled: boolean;
}

const NamesInput: FC<NamesInputProps> = ({ namesInput, onNamesInput, onNamesBlur, disabled }) => {
  return (
    <>
      <h3 data-trans>Enter names below</h3>
      <textarea
        id="in_names"
        placeholder="Input names separated by commas or line feed here"
        data-trans="placeholder"
        value={namesInput}
        onInput={onNamesInput}
        onBlur={onNamesBlur}
        disabled={disabled}
      ></textarea>
    </>
  );
};

export default NamesInput;
