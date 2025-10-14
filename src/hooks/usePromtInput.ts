import { useCallback, useMemo, useState } from 'react';

type UsePromptInputOptions = {
  minLen?: number;
  maxLen?: number;
  trimOnBlur?: boolean;
  initialValue?: string;
  validateExtra?: (value: string) => string | null; // optional custom validation
};

type ChangeEvt = React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>;

export type UsePromptInputReturn = {
  value: string;
  setValue: (v: string) => void;
  error: string | null;
  touched: boolean;
  length: number;
  remaining: number;
  canSubmit: boolean;
  onChange: (e: ChangeEvt) => void;
  onBlur: () => void;
  reset: (nextValue?: string) => void;
  setTouched: (t: boolean) => void;
  setError: (e: string | null) => void;
};

export function usePromptInput(options: UsePromptInputOptions = {}): UsePromptInputReturn {
  const {
    minLen = 5,
    maxLen = 10000,
    trimOnBlur = true,
    initialValue = '',
    validateExtra,
  } = options;

  const [value, setValue] = useState<string>(initialValue);
  const [touched, setTouched] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const baseValidate = useCallback(
    (val: string): string | null => {
      if (!val || val.trim().length === 0) return 'Введите текст';
      if (val.length < minLen) return `Минимум ${minLen} символов`;
      if (val.length > maxLen) return `Максимум ${maxLen} символов`;
      return null;
    },
    [minLen, maxLen],
  );

  const validate = useCallback(
    (val: string): string | null => {
      const baseErr = baseValidate(val);
      if (baseErr) return baseErr;
      if (validateExtra) return validateExtra(val);
      return null;
    },
    [baseValidate, validateExtra],
  );

  const length = value.length;
  const remaining = Math.max(0, maxLen - length);

  const canSubmit = useMemo(() => {
    const err = validate(value);
    return !err;
  }, [validate, value]);

  const onChange = useCallback(
    (e: ChangeEvt) => {
      const next = e.target.value;
      setValue(next);
      if (touched) setError(validate(next));
    },
    [touched, validate],
  );

  const onBlur = useCallback(() => {
    setTouched(true);
    const next = trimOnBlur ? value.trim() : value;
    if (trimOnBlur && next !== value) setValue(next);
    setError(validate(next));
  }, [trimOnBlur, value, validate]);

  const reset = useCallback((nextValue: string = '') => {
    setValue(nextValue);
    setTouched(false);
    setError(null);
  }, []);

  return {
    value,
    setValue,
    error,
    touched,
    length,
    remaining,
    canSubmit,
    onChange,
    onBlur,
    reset,
    setTouched,
    setError,
  };
}