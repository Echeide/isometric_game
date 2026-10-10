import {compile} from '@inlang/paraglide-js';
await compile({project:'./project.inlang',outdir:'./src/lib/paraglide',strategy:['cookie','preferredLanguage','baseLocale'],cookieName:'isometric_locale',emitTsDeclarations:true,outputStructure:'locale-modules'});
