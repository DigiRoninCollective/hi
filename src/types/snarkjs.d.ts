declare module 'snarkjs' {
  export const groth16: {
    verify: (verificationKey: unknown, publicSignals: unknown, proof: unknown) => Promise<boolean>
  }
}
