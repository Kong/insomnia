import { Property } from './properties';
import { UrlMatchPattern, UrlMatchPatternList } from './urls';

export interface SrcRef {
    src: string; // src is the path of the file
}

export interface CertificateOptions {
    name?: string;
    matches?: string[];
    key?: SrcRef;
    cert?: SrcRef;
    passphrase?: string;
    pfx?: SrcRef; // PFX or PKCS12 Certificate
    disabled?: boolean;
}

export class Certificate extends Property {
    override _kind: string = 'Certificate';

    override name?: string;
    matches?: UrlMatchPatternList<UrlMatchPattern>;
    key?: SrcRef;
    cert?: SrcRef;
    passphrase?: string;
    pfx?: SrcRef; // PFX or PKCS12 Certificate

    constructor(options: CertificateOptions) {
        super();

        this.name = options.name;
        this.matches = new UrlMatchPatternList(
            undefined,
            options.matches ?
                options.matches.map(matchStr => new UrlMatchPattern(matchStr)) :
                [],
        );
        this.key = options.key;
        this.cert = options.cert;
        this.passphrase = options.passphrase;
        this.pfx = options.pfx;
        this.disabled = options.disabled;
    }

    static isCertificate(obj: object) {
        return '_kind' in obj && obj._kind === 'Certificate';
    }

    canApplyTo(url: string) {
        return this.matches ? this.matches.test(url) : false;
    }

    update(options: CertificateOptions) {
        this.name = options.name;
        this.matches = new UrlMatchPatternList(
            undefined,
            options.matches ?
                options.matches.map(matchStr => new UrlMatchPattern(matchStr)) :
                [],
        );
        this.key = options.key;
        this.cert = options.cert;
        this.passphrase = options.passphrase;
        this.pfx = options.pfx;
    }
}
