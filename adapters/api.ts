import { createLogger } from '../helpers';
import { appContext } from '../app/context';
import { AxiosResponse } from 'axios';

// --------------------------------------------------------------
// Types
// --------------------------------------------------------------

export interface IApiService {
  upload(param: { token: string }, file: any, options: any): any;

  getVersion(param: { token: string }): any;
}

// --------------------------------------------------------------
// Main
// --------------------------------------------------------------

const logger = createLogger('adapters:api');

export const apiProxy = {
  upload: ({ token }, file, options?): AxiosResponse<Asuna.Schema.UploadResponse[]> =>
    appContext.ctx.api.upload({ token }, file, options),
  getVersion: ({ token }): string => appContext.ctx.api.getVersion({ token }),
};

export class ApiAdapter {
  constructor(private service: IApiService) {}

  upload = ({ token }, file, options): AxiosResponse<Asuna.Schema.UploadResponse[]> => {
    logger.log('[upload] file', file, options);
    return this.service.upload({ token }, file, options);
  };

  getVersion = ({ token }): string => this.service.getVersion({ token });
}
