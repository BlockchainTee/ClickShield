declare module 'punycode/' {
  interface PunycodeModule {
    toASCII(input: string): string;
    toUnicode(input: string): string;
  }

  const punycode: PunycodeModule;
  export default punycode;
}
