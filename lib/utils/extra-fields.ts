import { SubmitEvent } from './models';

export const extractExtraFields = (formDiv: HTMLDivElement): SubmitEvent => {
  const includedInputs: HTMLInputElement[] = Array.from(formDiv.querySelectorAll('input[data-opid]') ?? []);
  const extraData = includedInputs.reduce((acc, input) => {
    const key = input.getAttribute('data-opid');
    if (!key) return acc;
    return { ...acc, [key]: input.value };
  }, {});

  return SubmitEvent.parse(extraData);
};
