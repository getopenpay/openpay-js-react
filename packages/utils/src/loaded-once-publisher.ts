import { assertNever } from '@getopenpay/utils';
import { Subject, lastValueFrom, throwError, timeout } from 'rxjs';

export class LoadedOncePublisher<T> {
  private status:
    | {
        status: 'initial';
      }
    | {
        status: 'success';
        loadedValue: T;
      }
    | {
        status: 'error';
        error: unknown; // Anything can be thrown, so we don't want to be strict here
        errMsg: string;
      };
  private subject: Subject<T>;

  constructor() {
    this.status = { status: 'initial' };
    this.subject = new Subject<T>();
  }

  set = (value: T) => {
    if (this.status.status === 'success') {
      throw new Error('LoadedOnce is already in success state');
    }
    this.status = { status: 'success', loadedValue: value };
    this.subject.next(value);
    this.subject.complete();
  };

  setError = (error: unknown, errMsg: string) => {
    if (this.status.status === 'success') {
      throw new Error('LoadedOnce is already in success state');
    }
    this.status = { status: 'error', error, errMsg };
    this.subject.error(error);
    // Do not complete the subject since a set() call might be made after this
  };

  get current() {
    return this.status;
  }

  get isLoaded() {
    return this.current.status === 'success';
  }

  waitForLoad = (timeoutConfig: { ms: number; errMsg: string }): Promise<T> => {
    if (this.status.status === 'success') return Promise.resolve(this.status.loadedValue);
    if (this.status.status === 'error') return Promise.reject(this.status.error);
    if (this.status.status !== 'initial') assertNever(this.status);

    const timeoutParams = {
      first: timeoutConfig.ms,
      with: () => throwError(() => new Error(timeoutConfig.errMsg)),
    };

    return lastValueFrom(this.subject.pipe(timeout(timeoutParams)));
  };
}
