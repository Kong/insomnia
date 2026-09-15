import { Property } from './properties';
import { UrlMatchPattern, UrlMatchPatternList } from './urls';

/**
 * Represents a reference to a source file.
 *
 * @property src - The file path of the source file.
 */
export interface SrcRef {
  src: string; // src is the path of the file
}

/**
 * Represents the options for constructing a certificate.
 *
 * @property name - An optional name for the certificate.
 * @property matches - An optional array of strings specifying the domains
 *                     that the certificate should match.
 * @property key - An optional reference to the private key source.
 * @property cert - An optional reference to the certificate source.
 * @property passphrase - An optional passphrase for the private key or certificate.
 * @property pfx - An optional reference to a PFX or PKCS12 certificate source.
 * @property disabled - An optional flag indicating whether the certificate is disabled.
 * @interface
 */
export interface CertificateOptions {
  name?: string;
  matches?: string[];
  key?: SrcRef;
  cert?: SrcRef;
  passphrase?: string;
  pfx?: SrcRef; // PFX or PKCS12 Certificate
  disabled?: boolean;
}

/**
 * Represents a Certificate object that can be used to manage SSL/TLS certificates
 * and their associated properties. This class
 * provides functionality for defining certificate details, matching URL patterns,
 * and determining applicability to specific requests.
 */
export class Certificate extends Property {
  override _kind = 'Certificate';

  /**
   * An optional property representing the name of the certificate.
   * This can be used to identify or label the certificate.
   */
  override name?: string;
  /**
   * An optional list of URL match patterns used to determine if a certificate
   * should be applied to a specific request. Each pattern in the list is
   * evaluated against the request URL to check for a match.
   */
  matches?: UrlMatchPatternList<UrlMatchPattern>;
  /**
   * An optional property representing a reference to a source for the key.
   * This can be used to specify the location or content of a key, such as
   * a private key for SSL/TLS certificates.
   */
  key?: SrcRef;
  /**
   * Optional property representing a certificate source reference.
   * This can be used to specify the source of a certificate, such as
   * a file path or other reference, for use in secure connections.
   */
  cert?: SrcRef;
  /**
   * An optional passphrase used to access the private key of a certificate.
   */
  passphrase?: string;
  /**
   * Optional reference to a PFX or PKCS12 certificate.
   */
  pfx?: SrcRef; // PFX or PKCS12 Certificate

  /**
   * Constructs a new instance of the Certificate class.
   *
   * @param options - The options used to configure the certificate.
   */
  constructor(options: CertificateOptions) {
    super();

    this.name = options.name;
    this.matches = new UrlMatchPatternList(
      undefined,
      options.matches ? options.matches.map(matchStr => new UrlMatchPattern(matchStr)) : [],
    );
    this.key = options.key;
    this.cert = options.cert;
    this.passphrase = options.passphrase;
    this.pfx = options.pfx;
    this.disabled = options.disabled;
  }

  /**
   * Determines if the given object is a Certificate.
   *
   * @param obj - The object to check.
   * @returns A boolean indicating whether the object is a Certificate.
   */
  static isCertificate(obj: object) {
    return '_kind' in obj && obj._kind === 'Certificate';
  }

  /**
   * Determines whether the current certificate can be applied to the given URL.
   *
   * @param url - The URL to check against the certificate's match pattern.
   * @returns A boolean indicating whether the certificate matches the URL.
   */
  canApplyTo(url: string) {
    return this.matches ? this.matches.test(url) : false;
  }

  /**
   * Updates the certificate properties with the provided options.
   *
   * @param options - An object containing the certificate options to update.
   */
  update(options: CertificateOptions) {
    this.name = options.name;
    this.matches = new UrlMatchPatternList(
      undefined,
      options.matches ? options.matches.map(matchStr => new UrlMatchPattern(matchStr)) : [],
    );
    this.key = options.key;
    this.cert = options.cert;
    this.passphrase = options.passphrase;
    this.pfx = options.pfx;
  }
}
