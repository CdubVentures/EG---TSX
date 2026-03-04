/// <reference path="../.astro/types.d.ts" />

declare namespace App {
  interface Locals {
    /** Populated by middleware when eg_session cookie contains a valid JWT. */
    user: {
      uid: string;
      email: string | null;
      username: string | null;
    } | null;
  }
}
