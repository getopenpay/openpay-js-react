import { assertNever } from '@getopenpay/utils';
import { Subject, lastValueFrom, throwError, timeout } from 'rxjs';

type InitialStatus = {
  status: 'initial';
  isSuccess: false;
};
type SuccessStatus<T> = {
  status: 'success';
  isSuccess: true;
  loadedValue: T;
};
type ErrorStatus = {
  status: 'error';
  isSuccess: false;
  error: unknown; // Anything can be thrown, so we don't want to be strict here
  errMsg: string;
};
type CurrentStatus<T> = InitialStatus | SuccessStatus<T> | ErrorStatus;

export class LoadedOncePublisher<T> {
  private _current: CurrentStatus<T>;
  private _subject: Subject<T>;

  constructor() {
    this._current = { status: 'initial', isSuccess: false };
    this._subject = new Subject<T>();
  }

  set = (value: T) => {
    if (this._current.status === 'success') {
      throw new Error('LoadedOnce is already in success state');
    }
    this._current = { status: 'success', isSuccess: true, loadedValue: value };
    this._subject.next(value);
    this._subject.complete();
  };

  setError = (error: unknown, errMsg: string) => {
    if (this._current.status === 'success') {
      throw new Error('LoadedOnce is already in success state');
    }
    this._current = { status: 'error', isSuccess: false, error, errMsg };
    this._subject.error(error);
    // Do not complete the subject since a set() call might be made after this
  };

  get current() {
    return this._current;
  }

  subscribe = (fn: (value: Exclude<CurrentStatus<T>, InitialStatus>) => void) => {
    if (this._current.status === 'success') {
      fn(this._current);
      return;
    }

    if (this._current.status === 'error') {
      fn(this._current);
      // Do not return, as we will still have the fn subscribed to the subject
    }

    const subscription = this._subject.subscribe({
      next: () => {
        if (this._current.status !== 'success') {
          throw new Error('Invalid state (next): please make sure to update _current before the subject');
        }
        fn(this._current);
        subscription.unsubscribe();
      },
      error: () => {
        if (this._current.status !== 'error') {
          throw new Error('Invalid state (error): please make sure to update _current before the subject');
        }
        fn(this._current);
        // Do not unsubscribe
      },
    });
  };

  waitForLoad = (timeoutConfig: { timeoutSec: number; timeoutErrMsg: string }): Promise<T> => {
    if (this._current.status === 'success') return Promise.resolve(this._current.loadedValue);
    if (this._current.status === 'error') return Promise.reject(this._current.error);
    if (this._current.status !== 'initial') assertNever(this._current);

    const timeoutParams = {
      first: timeoutConfig.timeoutSec * 1000,
      with: () => throwError(() => new Error(timeoutConfig.timeoutErrMsg)),
    };

    return lastValueFrom(this._subject.pipe(timeout(timeoutParams)));
  };
}