import '@violentmonkey/types';

declare global {
  interface UADataValues {
    architecture?: string;
    bitness?: string;
    brands?: Array<{
      brand: string;
      version: string;
    }>;
    fullVersionList?: Array<{
      brand: string;
      version: string;
    }>;
    mobile?: boolean;
    model?: string;
    platform?: string;
    platformVersion?: string;
    uaFullVersion?: string;
    wow64?: boolean;
  }

  const __DEV__: boolean;
}

export {};
