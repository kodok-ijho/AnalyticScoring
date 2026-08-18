/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AI_CHAT_ENDPOINT?: string;
  readonly VITE_AI_CHAT_API_KEY?: string;
  readonly VITE_AI_CHAT_MODEL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
