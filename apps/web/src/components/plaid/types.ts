export type LinkOutcome =
  /** Web: Plaid Link handed us a public token. */
  | {
      kind: 'publicToken';
      publicToken: string;
      institution: { id: string | null; name: string } | null;
    }
  /** Native: the Hosted Link browser closed; the API looks up the result. */
  | { kind: 'hostedFinished' }
  | { kind: 'cancelled'; message: string | null };
