/**
 * Type declarations for optional vision SDK dependencies.
 * These are dynamically imported and may not be installed.
 */

declare module '@anthropic-ai/sdk' {
  export default class Anthropic {
    constructor(opts: { apiKey?: string });
    messages: {
      create(params: any): Promise<any>;
    };
  }
}

declare module '@google/generative-ai' {
  export class GoogleGenerativeAI {
    constructor(apiKey: string);
    getGenerativeModel(opts: { model: string }): any;
  }
}
