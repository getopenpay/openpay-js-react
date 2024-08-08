import { FC } from 'react';
import InputField from './input-field';

interface InputProps {
  type?: string;
  placeholder: string;
}

const Input: FC<InputProps> = ({ type, placeholder }) => (
  <input type={type ?? 'text'} placeholder={placeholder} className="w-full text-sm bg-transparent outline-none py-2" />
);

const HorizontalRule: FC = () => (
  <hr className="border-emerald-200 dark:border-emerald-700" />
);

const BillingDetails: FC = () => (
  <InputField>
    <Input placeholder="Name" />
    <HorizontalRule />
    <Input placeholder="Email" type="email" />
    <HorizontalRule />
    <Input placeholder="Address" />
    <HorizontalRule />
    <div className="flex gap-2 items-center justify-between">
      <Input placeholder="City" />
      <Input placeholder="State" />
      <Input placeholder="ZIP" />
    </div>
  </InputField>
);

export default BillingDetails;
