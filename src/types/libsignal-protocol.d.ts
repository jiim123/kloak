declare module 'libsignal-protocol' {
    interface KeyPairType {
      pubKey: ArrayBuffer;
      privKey: ArrayBuffer;
    }
  
    interface PreKeyType {
      keyId: number;
      keyPair: KeyPairType;
    }
  
    interface SignedPreKeyType {
      keyId: number;
      keyPair: KeyPairType;
      signature: ArrayBuffer;
    }
  
    namespace KeyHelper {
      function generateIdentityKeyPair(): Promise<KeyPairType>;
      function generateRegistrationId(): number;
      function generatePreKey(keyId: number): Promise<PreKeyType>;
      function generateSignedPreKey(
        identityKeyPair: KeyPairType,
        keyId: number
      ): Promise<SignedPreKeyType>;
    }
  
    class SignalProtocolAddress {
      constructor(name: string, deviceId: number);
      getName(): string;
      getDeviceId(): number;
    }
  
    class SessionBuilder {
      constructor(store: any, address: SignalProtocolAddress);
      processPreKey(preKeyBundle: any): Promise<void>;
    }
  
    class SessionCipher {
      constructor(store: any, address: SignalProtocolAddress);
      encrypt(plaintext: ArrayBuffer): Promise<{
        type: number;
        body: string;
      }>;
      decryptPreKeyWhisperMessage(
        ciphertext: string,
        encoding: string
      ): Promise<ArrayBuffer>;
      decryptWhisperMessage(
        ciphertext: string,
        encoding: string
      ): Promise<ArrayBuffer>;
    }
  }