// parse.js — a from-scratch CommonMark 0.31.2 + GFM renderer.
// It aims to produce the same HTML as marked 18.1.3 under its default
// settings (GFM enabled, soft breaks kept, no pedantic mode, sync).
// No third-party code is used; the scanners below are written by hand.
// Public API: parse(markdown) -> HTML string.
export function parse(md){ return new Doc(md).renderDocument(); }

// ---- numeric character references: "#65" / "#x41" -> the character ----
// Returns null for a malformed reference; out-of-range or surrogate codes
// become U+FFFD, matching the HTML spec's handling of bad references.
function decodeNumeric(spec){
  const hex = spec[1]==='x'||spec[1]==='X';
  const code = hex ? parseInt(spec.slice(2),16) : parseInt(spec.slice(1),10);
  if(Number.isNaN(code)||code>0x10FFFF) return null;
  if(code===0||(code>=0xD800&&code<=0xDFFF)) return '\uFFFD';
  return String.fromCodePoint(code);
}

// ---- character classes: ASCII fast path, Unicode fallback ----
// Punctuation and whitespace checks stay cheap for the common ASCII case
// and only fall back to a Unicode property test for other code points.
const PUNCT_RE=/[!-\/:-@\[-`{-~]/;
function isPunct(ch){ const c=ch.charCodeAt(0); if(c<128) return PUNCT_RE.test(ch); return /[\p{P}\p{S}]/u.test(ch); }
function isSpace(ch){ const c=ch.charCodeAt(0); if(c<128) return c===32||c===9||c===10||c===13||c===12||c===11; return /\s/.test(ch); }
function hasNamedEnt(name){ return NAMED_ENTS.has(name); }
// ---- named HTML5 entities: compact pieces, "\u001f" between entries ----
// (same 2,125 name=value pairs as the HTML5 list; layout only differs)
const ENT_CHUNKS=[
"AElig=Æ\u001fAMP=&\u001fAacute=Á\u001fAbreve=Ă\u001fAcirc=Â\u001fAcy=А\u001fAfr=𝔄\u001fAgrave=À\u001fAlpha=Α\u001fAmacr=Ā\u001fAnd=⩓\u001fAogon=Ą\u001fAopf=𝔸\u001fApplyFunction=⁡\u001fAring=Å\u001fAscr=𝒜\u001fAssign=≔\u001fAtilde=Ã\u001fAuml=Ä\u001fBackslash=∖\u001fBarv=⫧\u001fBarwed=⌆\u001fBcy=Б\u001fBecause=∵\u001fBernoullis=ℬ\u001fBeta=Β\u001fBfr=𝔅\u001fBopf=𝔹\u001fBreve=˘\u001fBscr=ℬ\u001fBumpeq=≎\u001fCHcy=Ч\u001fCOPY=©\u001fCacute=Ć\u001fCap=⋒\u001fCapitalDifferentialD=ⅅ\u001fCayleys=ℭ\u001fCcaron=Č\u001fCcedil=Ç\u001fCcirc=Ĉ\u001fCconint=∰\u001fCdot=Ċ\u001fCedilla=¸\u001fCenterDot=·\u001fCfr=ℭ",
"Chi=Χ\u001fCircleDot=⊙\u001fCircleMinus=⊖\u001fCirclePlus=⊕\u001fCircleTimes=⊗\u001fClockwiseContourIntegral=∲\u001fCloseCurlyDoubleQuote=”\u001fCloseCurlyQuote=’\u001fColon=∷\u001fColone=⩴\u001fCongruent=≡\u001fConint=∯\u001fContourIntegral=∮\u001fCopf=ℂ\u001fCoproduct=∐\u001fCounterClockwiseContourIntegral=∳\u001fCross=⨯\u001fCscr=𝒞\u001fCup=⋓\u001fCupCap=≍\u001fDD=ⅅ\u001fDDotrahd=⤑\u001fDJcy=Ђ\u001fDScy=Ѕ\u001fDZcy=Џ\u001fDagger=‡\u001fDarr=↡\u001fDashv=⫤\u001fDcaron=Ď\u001fDcy=Д\u001fDel=∇\u001fDelta=Δ\u001fDfr=𝔇\u001fDiacriticalAcute=´\u001fDiacriticalDot=˙\u001fDiacriticalDoubleAcute=˝\u001fDiacriticalGrave=`\u001fDiacriticalTilde=˜\u001fDiamond=⋄\u001fDifferentialD=ⅆ\u001fDopf=𝔻\u001fDot=¨\u001fDotDot=⃜\u001fDotEqual=≐\u001fDoubleContourIntegral=∯",
"DoubleDot=¨\u001fDoubleDownArrow=⇓\u001fDoubleLeftArrow=⇐\u001fDoubleLeftRightArrow=⇔\u001fDoubleLeftTee=⫤\u001fDoubleLongLeftArrow=⟸\u001fDoubleLongLeftRightArrow=⟺\u001fDoubleLongRightArrow=⟹\u001fDoubleRightArrow=⇒\u001fDoubleRightTee=⊨\u001fDoubleUpArrow=⇑\u001fDoubleUpDownArrow=⇕\u001fDoubleVerticalBar=∥\u001fDownArrow=↓\u001fDownArrowBar=⤓\u001fDownArrowUpArrow=⇵\u001fDownBreve=̑\u001fDownLeftRightVector=⥐\u001fDownLeftTeeVector=⥞\u001fDownLeftVector=↽\u001fDownLeftVectorBar=⥖\u001fDownRightTeeVector=⥟\u001fDownRightVector=⇁\u001fDownRightVectorBar=⥗\u001fDownTee=⊤\u001fDownTeeArrow=↧\u001fDownarrow=⇓\u001fDscr=𝒟\u001fDstrok=Đ\u001fENG=Ŋ\u001fETH=Ð\u001fEacute=É\u001fEcaron=Ě\u001fEcirc=Ê\u001fEcy=Э\u001fEdot=Ė\u001fEfr=𝔈\u001fEgrave=È\u001fElement=∈\u001fEmacr=Ē\u001fEmptySmallSquare=◻\u001fEmptyVerySmallSquare=▫\u001fEogon=Ę\u001fEopf=𝔼\u001fEpsilon=Ε",
"Equal=⩵\u001fEqualTilde=≂\u001fEquilibrium=⇌\u001fEscr=ℰ\u001fEsim=⩳\u001fEta=Η\u001fEuml=Ë\u001fExists=∃\u001fExponentialE=ⅇ\u001fFcy=Ф\u001fFfr=𝔉\u001fFilledSmallSquare=◼\u001fFilledVerySmallSquare=▪\u001fFopf=𝔽\u001fForAll=∀\u001fFouriertrf=ℱ\u001fFscr=ℱ\u001fGJcy=Ѓ\u001fGT=>\u001fGamma=Γ\u001fGammad=Ϝ\u001fGbreve=Ğ\u001fGcedil=Ģ\u001fGcirc=Ĝ\u001fGcy=Г\u001fGdot=Ġ\u001fGfr=𝔊\u001fGg=⋙\u001fGopf=𝔾\u001fGreaterEqual=≥\u001fGreaterEqualLess=⋛\u001fGreaterFullEqual=≧\u001fGreaterGreater=⪢\u001fGreaterLess=≷\u001fGreaterSlantEqual=⩾\u001fGreaterTilde=≳\u001fGscr=𝒢\u001fGt=≫\u001fHARDcy=Ъ\u001fHacek=ˇ\u001fHat=^\u001fHcirc=Ĥ\u001fHfr=ℌ\u001fHilbertSpace=ℋ\u001fHopf=ℍ",
"HorizontalLine=─\u001fHscr=ℋ\u001fHstrok=Ħ\u001fHumpDownHump=≎\u001fHumpEqual=≏\u001fIEcy=Е\u001fIJlig=Ĳ\u001fIOcy=Ё\u001fIacute=Í\u001fIcirc=Î\u001fIcy=И\u001fIdot=İ\u001fIfr=ℑ\u001fIgrave=Ì\u001fIm=ℑ\u001fImacr=Ī\u001fImaginaryI=ⅈ\u001fImplies=⇒\u001fInt=∬\u001fIntegral=∫\u001fIntersection=⋂\u001fInvisibleComma=⁣\u001fInvisibleTimes=⁢\u001fIogon=Į\u001fIopf=𝕀\u001fIota=Ι\u001fIscr=ℐ\u001fItilde=Ĩ\u001fIukcy=І\u001fIuml=Ï\u001fJcirc=Ĵ\u001fJcy=Й\u001fJfr=𝔍\u001fJopf=𝕁\u001fJscr=𝒥\u001fJsercy=Ј\u001fJukcy=Є\u001fKHcy=Х\u001fKJcy=Ќ\u001fKappa=Κ\u001fKcedil=Ķ\u001fKcy=К\u001fKfr=𝔎\u001fKopf=𝕂\u001fKscr=𝒦",
"LJcy=Љ\u001fLT=<\u001fLacute=Ĺ\u001fLambda=Λ\u001fLang=⟪\u001fLaplacetrf=ℒ\u001fLarr=↞\u001fLcaron=Ľ\u001fLcedil=Ļ\u001fLcy=Л\u001fLeftAngleBracket=⟨\u001fLeftArrow=←\u001fLeftArrowBar=⇤\u001fLeftArrowRightArrow=⇆\u001fLeftCeiling=⌈\u001fLeftDoubleBracket=⟦\u001fLeftDownTeeVector=⥡\u001fLeftDownVector=⇃\u001fLeftDownVectorBar=⥙\u001fLeftFloor=⌊\u001fLeftRightArrow=↔\u001fLeftRightVector=⥎\u001fLeftTee=⊣\u001fLeftTeeArrow=↤\u001fLeftTeeVector=⥚\u001fLeftTriangle=⊲\u001fLeftTriangleBar=⧏\u001fLeftTriangleEqual=⊴\u001fLeftUpDownVector=⥑\u001fLeftUpTeeVector=⥠\u001fLeftUpVector=↿\u001fLeftUpVectorBar=⥘\u001fLeftVector=↼\u001fLeftVectorBar=⥒\u001fLeftarrow=⇐\u001fLeftrightarrow=⇔\u001fLessEqualGreater=⋚\u001fLessFullEqual=≦\u001fLessGreater=≶\u001fLessLess=⪡\u001fLessSlantEqual=⩽\u001fLessTilde=≲\u001fLfr=𝔏\u001fLl=⋘\u001fLleftarrow=⇚",
"Lmidot=Ŀ\u001fLongLeftArrow=⟵\u001fLongLeftRightArrow=⟷\u001fLongRightArrow=⟶\u001fLongleftarrow=⟸\u001fLongleftrightarrow=⟺\u001fLongrightarrow=⟹\u001fLopf=𝕃\u001fLowerLeftArrow=↙\u001fLowerRightArrow=↘\u001fLscr=ℒ\u001fLsh=↰\u001fLstrok=Ł\u001fLt=≪\u001fMap=⤅\u001fMcy=М\u001fMediumSpace= \u001fMellintrf=ℳ\u001fMfr=𝔐\u001fMinusPlus=∓\u001fMopf=𝕄\u001fMscr=ℳ\u001fMu=Μ\u001fNJcy=Њ\u001fNacute=Ń\u001fNcaron=Ň\u001fNcedil=Ņ\u001fNcy=Н\u001fNegativeMediumSpace=​\u001fNegativeThickSpace=​\u001fNegativeThinSpace=​\u001fNegativeVeryThinSpace=​\u001fNestedGreaterGreater=≫\u001fNestedLessLess=≪\u001fNewLine=\n\u001fNfr=𝔑\u001fNoBreak=⁠\u001fNonBreakingSpace= \u001fNopf=ℕ\u001fNot=⫬\u001fNotCongruent=≢\u001fNotCupCap=≭\u001fNotDoubleVerticalBar=∦\u001fNotElement=∉\u001fNotEqual=≠",
"NotEqualTilde=≂̸\u001fNotExists=∄\u001fNotGreater=≯\u001fNotGreaterEqual=≱\u001fNotGreaterFullEqual=≧̸\u001fNotGreaterGreater=≫̸\u001fNotGreaterLess=≹\u001fNotGreaterSlantEqual=⩾̸\u001fNotGreaterTilde=≵\u001fNotHumpDownHump=≎̸\u001fNotHumpEqual=≏̸\u001fNotLeftTriangle=⋪\u001fNotLeftTriangleBar=⧏̸\u001fNotLeftTriangleEqual=⋬\u001fNotLess=≮\u001fNotLessEqual=≰\u001fNotLessGreater=≸\u001fNotLessLess=≪̸\u001fNotLessSlantEqual=⩽̸\u001fNotLessTilde=≴\u001fNotNestedGreaterGreater=⪢̸\u001fNotNestedLessLess=⪡̸\u001fNotPrecedes=⊀\u001fNotPrecedesEqual=⪯̸\u001fNotPrecedesSlantEqual=⋠\u001fNotReverseElement=∌\u001fNotRightTriangle=⋫\u001fNotRightTriangleBar=⧐̸\u001fNotRightTriangleEqual=⋭\u001fNotSquareSubset=⊏̸\u001fNotSquareSubsetEqual=⋢\u001fNotSquareSuperset=⊐̸\u001fNotSquareSupersetEqual=⋣\u001fNotSubset=⊂⃒\u001fNotSubsetEqual=⊈\u001fNotSucceeds=⊁\u001fNotSucceedsEqual=⪰̸\u001fNotSucceedsSlantEqual=⋡\u001fNotSucceedsTilde=≿̸\u001fNotSuperset=⊃⃒\u001fNotSupersetEqual=⊉\u001fNotTilde=≁\u001fNotTildeEqual=≄\u001fNotTildeFullEqual=≇\u001fNotTildeTilde=≉",
"NotVerticalBar=∤\u001fNscr=𝒩\u001fNtilde=Ñ\u001fNu=Ν\u001fOElig=Œ\u001fOacute=Ó\u001fOcirc=Ô\u001fOcy=О\u001fOdblac=Ő\u001fOfr=𝔒\u001fOgrave=Ò\u001fOmacr=Ō\u001fOmega=Ω\u001fOmicron=Ο\u001fOopf=𝕆\u001fOpenCurlyDoubleQuote=“\u001fOpenCurlyQuote=‘\u001fOr=⩔\u001fOscr=𝒪\u001fOslash=Ø\u001fOtilde=Õ\u001fOtimes=⨷\u001fOuml=Ö\u001fOverBar=‾\u001fOverBrace=⏞\u001fOverBracket=⎴\u001fOverParenthesis=⏜\u001fPartialD=∂\u001fPcy=П\u001fPfr=𝔓\u001fPhi=Φ\u001fPi=Π\u001fPlusMinus=±\u001fPoincareplane=ℌ\u001fPopf=ℙ\u001fPr=⪻\u001fPrecedes=≺\u001fPrecedesEqual=⪯\u001fPrecedesSlantEqual=≼\u001fPrecedesTilde=≾\u001fPrime=″\u001fProduct=∏\u001fProportion=∷\u001fProportional=∝\u001fPscr=𝒫",
"Psi=Ψ\u001fQUOT=\"\u001fQfr=𝔔\u001fQopf=ℚ\u001fQscr=𝒬\u001fRBarr=⤐\u001fREG=®\u001fRacute=Ŕ\u001fRang=⟫\u001fRarr=↠\u001fRarrtl=⤖\u001fRcaron=Ř\u001fRcedil=Ŗ\u001fRcy=Р\u001fRe=ℜ\u001fReverseElement=∋\u001fReverseEquilibrium=⇋\u001fReverseUpEquilibrium=⥯\u001fRfr=ℜ\u001fRho=Ρ\u001fRightAngleBracket=⟩\u001fRightArrow=→\u001fRightArrowBar=⇥\u001fRightArrowLeftArrow=⇄\u001fRightCeiling=⌉\u001fRightDoubleBracket=⟧\u001fRightDownTeeVector=⥝\u001fRightDownVector=⇂\u001fRightDownVectorBar=⥕\u001fRightFloor=⌋\u001fRightTee=⊢\u001fRightTeeArrow=↦\u001fRightTeeVector=⥛\u001fRightTriangle=⊳\u001fRightTriangleBar=⧐\u001fRightTriangleEqual=⊵\u001fRightUpDownVector=⥏\u001fRightUpTeeVector=⥜\u001fRightUpVector=↾\u001fRightUpVectorBar=⥔\u001fRightVector=⇀\u001fRightVectorBar=⥓\u001fRightarrow=⇒\u001fRopf=ℝ\u001fRoundImplies=⥰",
"Rrightarrow=⇛\u001fRscr=ℛ\u001fRsh=↱\u001fRuleDelayed=⧴\u001fSHCHcy=Щ\u001fSHcy=Ш\u001fSOFTcy=Ь\u001fSacute=Ś\u001fSc=⪼\u001fScaron=Š\u001fScedil=Ş\u001fScirc=Ŝ\u001fScy=С\u001fSfr=𝔖\u001fShortDownArrow=↓\u001fShortLeftArrow=←\u001fShortRightArrow=→\u001fShortUpArrow=↑\u001fSigma=Σ\u001fSmallCircle=∘\u001fSopf=𝕊\u001fSqrt=√\u001fSquare=□\u001fSquareIntersection=⊓\u001fSquareSubset=⊏\u001fSquareSubsetEqual=⊑\u001fSquareSuperset=⊐\u001fSquareSupersetEqual=⊒\u001fSquareUnion=⊔\u001fSscr=𝒮\u001fStar=⋆\u001fSub=⋐\u001fSubset=⋐\u001fSubsetEqual=⊆\u001fSucceeds=≻\u001fSucceedsEqual=⪰\u001fSucceedsSlantEqual=≽\u001fSucceedsTilde=≿\u001fSuchThat=∋\u001fSum=∑\u001fSup=⋑\u001fSuperset=⊃\u001fSupersetEqual=⊇\u001fSupset=⋑\u001fTHORN=Þ",
"TRADE=™\u001fTSHcy=Ћ\u001fTScy=Ц\u001fTab=\t\u001fTau=Τ\u001fTcaron=Ť\u001fTcedil=Ţ\u001fTcy=Т\u001fTfr=𝔗\u001fTherefore=∴\u001fTheta=Θ\u001fThickSpace=  \u001fThinSpace= \u001fTilde=∼\u001fTildeEqual=≃\u001fTildeFullEqual=≅\u001fTildeTilde=≈\u001fTopf=𝕋\u001fTripleDot=⃛\u001fTscr=𝒯\u001fTstrok=Ŧ\u001fUacute=Ú\u001fUarr=↟\u001fUarrocir=⥉\u001fUbrcy=Ў\u001fUbreve=Ŭ\u001fUcirc=Û\u001fUcy=У\u001fUdblac=Ű\u001fUfr=𝔘\u001fUgrave=Ù\u001fUmacr=Ū\u001fUnderBar=_\u001fUnderBrace=⏟\u001fUnderBracket=⎵\u001fUnderParenthesis=⏝\u001fUnion=⋃\u001fUnionPlus=⊎\u001fUogon=Ų\u001fUopf=𝕌\u001fUpArrow=↑\u001fUpArrowBar=⤒\u001fUpArrowDownArrow=⇅\u001fUpDownArrow=↕\u001fUpEquilibrium=⥮",
"UpTee=⊥\u001fUpTeeArrow=↥\u001fUparrow=⇑\u001fUpdownarrow=⇕\u001fUpperLeftArrow=↖\u001fUpperRightArrow=↗\u001fUpsi=ϒ\u001fUpsilon=Υ\u001fUring=Ů\u001fUscr=𝒰\u001fUtilde=Ũ\u001fUuml=Ü\u001fVDash=⊫\u001fVbar=⫫\u001fVcy=В\u001fVdash=⊩\u001fVdashl=⫦\u001fVee=⋁\u001fVerbar=‖\u001fVert=‖\u001fVerticalBar=∣\u001fVerticalLine=|\u001fVerticalSeparator=❘\u001fVerticalTilde=≀\u001fVeryThinSpace= \u001fVfr=𝔙\u001fVopf=𝕍\u001fVscr=𝒱\u001fVvdash=⊪\u001fWcirc=Ŵ\u001fWedge=⋀\u001fWfr=𝔚\u001fWopf=𝕎\u001fWscr=𝒲\u001fXfr=𝔛\u001fXi=Ξ\u001fXopf=𝕏\u001fXscr=𝒳\u001fYAcy=Я\u001fYIcy=Ї\u001fYUcy=Ю\u001fYacute=Ý\u001fYcirc=Ŷ\u001fYcy=Ы\u001fYfr=𝔜",
"Yopf=𝕐\u001fYscr=𝒴\u001fYuml=Ÿ\u001fZHcy=Ж\u001fZacute=Ź\u001fZcaron=Ž\u001fZcy=З\u001fZdot=Ż\u001fZeroWidthSpace=​\u001fZeta=Ζ\u001fZfr=ℨ\u001fZopf=ℤ\u001fZscr=𝒵\u001faacute=á\u001fabreve=ă\u001fac=∾\u001facE=∾̳\u001facd=∿\u001facirc=â\u001facute=´\u001facy=а\u001faelig=æ\u001faf=⁡\u001fafr=𝔞\u001fagrave=à\u001falefsym=ℵ\u001faleph=ℵ\u001falpha=α\u001famacr=ā\u001famalg=⨿\u001famp=&\u001fand=∧\u001fandand=⩕\u001fandd=⩜\u001fandslope=⩘\u001fandv=⩚\u001fang=∠\u001fange=⦤\u001fangle=∠\u001fangmsd=∡\u001fangmsdaa=⦨\u001fangmsdab=⦩\u001fangmsdac=⦪\u001fangmsdad=⦫\u001fangmsdae=⦬",
"angmsdaf=⦭\u001fangmsdag=⦮\u001fangmsdah=⦯\u001fangrt=∟\u001fangrtvb=⊾\u001fangrtvbd=⦝\u001fangsph=∢\u001fangst=Å\u001fangzarr=⍼\u001faogon=ą\u001faopf=𝕒\u001fap=≈\u001fapE=⩰\u001fapacir=⩯\u001fape=≊\u001fapid=≋\u001fapos='\u001fapprox=≈\u001fapproxeq=≊\u001faring=å\u001fascr=𝒶\u001fast=*\u001fasymp=≈\u001fasympeq=≍\u001fatilde=ã\u001fauml=ä\u001fawconint=∳\u001fawint=⨑\u001fbNot=⫭\u001fbackcong=≌\u001fbackepsilon=϶\u001fbackprime=‵\u001fbacksim=∽\u001fbacksimeq=⋍\u001fbarvee=⊽\u001fbarwed=⌅\u001fbarwedge=⌅\u001fbbrk=⎵\u001fbbrktbrk=⎶\u001fbcong=≌\u001fbcy=б\u001fbdquo=„\u001fbecaus=∵\u001fbecause=∵\u001fbemptyv=⦰",
"bepsi=϶\u001fbernou=ℬ\u001fbeta=β\u001fbeth=ℶ\u001fbetween=≬\u001fbfr=𝔟\u001fbigcap=⋂\u001fbigcirc=◯\u001fbigcup=⋃\u001fbigodot=⨀\u001fbigoplus=⨁\u001fbigotimes=⨂\u001fbigsqcup=⨆\u001fbigstar=★\u001fbigtriangledown=▽\u001fbigtriangleup=△\u001fbiguplus=⨄\u001fbigvee=⋁\u001fbigwedge=⋀\u001fbkarow=⤍\u001fblacklozenge=⧫\u001fblacksquare=▪\u001fblacktriangle=▴\u001fblacktriangledown=▾\u001fblacktriangleleft=◂\u001fblacktriangleright=▸\u001fblank=␣\u001fblk12=▒\u001fblk14=░\u001fblk34=▓\u001fblock=█\u001fbne==⃥\u001fbnequiv=≡⃥\u001fbnot=⌐\u001fbopf=𝕓\u001fbot=⊥\u001fbottom=⊥\u001fbowtie=⋈\u001fboxDL=╗\u001fboxDR=╔\u001fboxDl=╖\u001fboxDr=╓\u001fboxH=═\u001fboxHD=╦\u001fboxHU=╩",
"boxHd=╤\u001fboxHu=╧\u001fboxUL=╝\u001fboxUR=╚\u001fboxUl=╜\u001fboxUr=╙\u001fboxV=║\u001fboxVH=╬\u001fboxVL=╣\u001fboxVR=╠\u001fboxVh=╫\u001fboxVl=╢\u001fboxVr=╟\u001fboxbox=⧉\u001fboxdL=╕\u001fboxdR=╒\u001fboxdl=┐\u001fboxdr=┌\u001fboxh=─\u001fboxhD=╥\u001fboxhU=╨\u001fboxhd=┬\u001fboxhu=┴\u001fboxminus=⊟\u001fboxplus=⊞\u001fboxtimes=⊠\u001fboxuL=╛\u001fboxuR=╘\u001fboxul=┘\u001fboxur=└\u001fboxv=│\u001fboxvH=╪\u001fboxvL=╡\u001fboxvR=╞\u001fboxvh=┼\u001fboxvl=┤\u001fboxvr=├\u001fbprime=‵\u001fbreve=˘\u001fbrvbar=¦\u001fbscr=𝒷\u001fbsemi=⁏\u001fbsim=∽\u001fbsime=⋍\u001fbsol=\\",
"bsolb=⧅\u001fbsolhsub=⟈\u001fbull=•\u001fbullet=•\u001fbump=≎\u001fbumpE=⪮\u001fbumpe=≏\u001fbumpeq=≏\u001fcacute=ć\u001fcap=∩\u001fcapand=⩄\u001fcapbrcup=⩉\u001fcapcap=⩋\u001fcapcup=⩇\u001fcapdot=⩀\u001fcaps=∩︀\u001fcaret=⁁\u001fcaron=ˇ\u001fccaps=⩍\u001fccaron=č\u001fccedil=ç\u001fccirc=ĉ\u001fccups=⩌\u001fccupssm=⩐\u001fcdot=ċ\u001fcedil=¸\u001fcemptyv=⦲\u001fcent=¢\u001fcenterdot=·\u001fcfr=𝔠\u001fchcy=ч\u001fcheck=✓\u001fcheckmark=✓\u001fchi=χ\u001fcir=○\u001fcirE=⧃\u001fcirc=ˆ\u001fcirceq=≗\u001fcirclearrowleft=↺\u001fcirclearrowright=↻\u001fcircledR=®\u001fcircledS=Ⓢ\u001fcircledast=⊛\u001fcircledcirc=⊚\u001fcircleddash=⊝",
"cire=≗\u001fcirfnint=⨐\u001fcirmid=⫯\u001fcirscir=⧂\u001fclubs=♣\u001fclubsuit=♣\u001fcolon=:\u001fcolone=≔\u001fcoloneq=≔\u001fcomma=,\u001fcommat=@\u001fcomp=∁\u001fcompfn=∘\u001fcomplement=∁\u001fcomplexes=ℂ\u001fcong=≅\u001fcongdot=⩭\u001fconint=∮\u001fcopf=𝕔\u001fcoprod=∐\u001fcopy=©\u001fcopysr=℗\u001fcrarr=↵\u001fcross=✗\u001fcscr=𝒸\u001fcsub=⫏\u001fcsube=⫑\u001fcsup=⫐\u001fcsupe=⫒\u001fctdot=⋯\u001fcudarrl=⤸\u001fcudarrr=⤵\u001fcuepr=⋞\u001fcuesc=⋟\u001fcularr=↶\u001fcularrp=⤽\u001fcup=∪\u001fcupbrcap=⩈\u001fcupcap=⩆\u001fcupcup=⩊\u001fcupdot=⊍\u001fcupor=⩅\u001fcups=∪︀\u001fcurarr=↷\u001fcurarrm=⤼",
"curlyeqprec=⋞\u001fcurlyeqsucc=⋟\u001fcurlyvee=⋎\u001fcurlywedge=⋏\u001fcurren=¤\u001fcurvearrowleft=↶\u001fcurvearrowright=↷\u001fcuvee=⋎\u001fcuwed=⋏\u001fcwconint=∲\u001fcwint=∱\u001fcylcty=⌭\u001fdArr=⇓\u001fdHar=⥥\u001fdagger=†\u001fdaleth=ℸ\u001fdarr=↓\u001fdash=‐\u001fdashv=⊣\u001fdbkarow=⤏\u001fdblac=˝\u001fdcaron=ď\u001fdcy=д\u001fdd=ⅆ\u001fddagger=‡\u001fddarr=⇊\u001fddotseq=⩷\u001fdeg=°\u001fdelta=δ\u001fdemptyv=⦱\u001fdfisht=⥿\u001fdfr=𝔡\u001fdharl=⇃\u001fdharr=⇂\u001fdiam=⋄\u001fdiamond=⋄\u001fdiamondsuit=♦\u001fdiams=♦\u001fdie=¨\u001fdigamma=ϝ\u001fdisin=⋲\u001fdiv=÷\u001fdivide=÷\u001fdivideontimes=⋇\u001fdivonx=⋇",
"djcy=ђ\u001fdlcorn=⌞\u001fdlcrop=⌍\u001fdollar=$\u001fdopf=𝕕\u001fdot=˙\u001fdoteq=≐\u001fdoteqdot=≑\u001fdotminus=∸\u001fdotplus=∔\u001fdotsquare=⊡\u001fdoublebarwedge=⌆\u001fdownarrow=↓\u001fdowndownarrows=⇊\u001fdownharpoonleft=⇃\u001fdownharpoonright=⇂\u001fdrbkarow=⤐\u001fdrcorn=⌟\u001fdrcrop=⌌\u001fdscr=𝒹\u001fdscy=ѕ\u001fdsol=⧶\u001fdstrok=đ\u001fdtdot=⋱\u001fdtri=▿\u001fdtrif=▾\u001fduarr=⇵\u001fduhar=⥯\u001fdwangle=⦦\u001fdzcy=џ\u001fdzigrarr=⟿\u001feDDot=⩷\u001feDot=≑\u001feacute=é\u001feaster=⩮\u001fecaron=ě\u001fecir=≖\u001fecirc=ê\u001fecolon=≕\u001fecy=э\u001fedot=ė\u001fee=ⅇ\u001fefDot=≒\u001fefr=𝔢\u001feg=⪚",
"egrave=è\u001fegs=⪖\u001fegsdot=⪘\u001fel=⪙\u001felinters=⏧\u001fell=ℓ\u001fels=⪕\u001felsdot=⪗\u001femacr=ē\u001fempty=∅\u001femptyset=∅\u001femptyv=∅\u001femsp13= \u001femsp14= \u001femsp= \u001feng=ŋ\u001fensp= \u001feogon=ę\u001feopf=𝕖\u001fepar=⋕\u001feparsl=⧣\u001feplus=⩱\u001fepsi=ε\u001fepsilon=ε\u001fepsiv=ϵ\u001feqcirc=≖\u001feqcolon=≕\u001feqsim=≂\u001feqslantgtr=⪖\u001feqslantless=⪕\u001fequals==\u001fequest=≟\u001fequiv=≡\u001fequivDD=⩸\u001feqvparsl=⧥\u001ferDot=≓\u001ferarr=⥱\u001fescr=ℯ\u001fesdot=≐\u001fesim=≂\u001feta=η\u001feth=ð\u001feuml=ë\u001feuro=€\u001fexcl=!",
"exist=∃\u001fexpectation=ℰ\u001fexponentiale=ⅇ\u001ffallingdotseq=≒\u001ffcy=ф\u001ffemale=♀\u001fffilig=ﬃ\u001ffflig=ﬀ\u001fffllig=ﬄ\u001fffr=𝔣\u001ffilig=ﬁ\u001ffjlig=fj\u001fflat=♭\u001ffllig=ﬂ\u001ffltns=▱\u001ffnof=ƒ\u001ffopf=𝕗\u001fforall=∀\u001ffork=⋔\u001fforkv=⫙\u001ffpartint=⨍\u001ffrac12=½\u001ffrac13=⅓\u001ffrac14=¼\u001ffrac15=⅕\u001ffrac16=⅙\u001ffrac18=⅛\u001ffrac23=⅔\u001ffrac25=⅖\u001ffrac34=¾\u001ffrac35=⅗\u001ffrac38=⅜\u001ffrac45=⅘\u001ffrac56=⅚\u001ffrac58=⅝\u001ffrac78=⅞\u001ffrasl=⁄\u001ffrown=⌢\u001ffscr=𝒻\u001fgE=≧\u001fgEl=⪌\u001fgacute=ǵ\u001fgamma=γ\u001fgammad=ϝ\u001fgap=⪆",
"gbreve=ğ\u001fgcirc=ĝ\u001fgcy=г\u001fgdot=ġ\u001fge=≥\u001fgel=⋛\u001fgeq=≥\u001fgeqq=≧\u001fgeqslant=⩾\u001fges=⩾\u001fgescc=⪩\u001fgesdot=⪀\u001fgesdoto=⪂\u001fgesdotol=⪄\u001fgesl=⋛︀\u001fgesles=⪔\u001fgfr=𝔤\u001fgg=≫\u001fggg=⋙\u001fgimel=ℷ\u001fgjcy=ѓ\u001fgl=≷\u001fglE=⪒\u001fgla=⪥\u001fglj=⪤\u001fgnE=≩\u001fgnap=⪊\u001fgnapprox=⪊\u001fgne=⪈\u001fgneq=⪈\u001fgneqq=≩\u001fgnsim=⋧\u001fgopf=𝕘\u001fgrave=`\u001fgscr=ℊ\u001fgsim=≳\u001fgsime=⪎\u001fgsiml=⪐\u001fgt=>\u001fgtcc=⪧\u001fgtcir=⩺\u001fgtdot=⋗\u001fgtlPar=⦕\u001fgtquest=⩼\u001fgtrapprox=⪆",
"gtrarr=⥸\u001fgtrdot=⋗\u001fgtreqless=⋛\u001fgtreqqless=⪌\u001fgtrless=≷\u001fgtrsim=≳\u001fgvertneqq=≩︀\u001fgvnE=≩︀\u001fhArr=⇔\u001fhairsp= \u001fhalf=½\u001fhamilt=ℋ\u001fhardcy=ъ\u001fharr=↔\u001fharrcir=⥈\u001fharrw=↭\u001fhbar=ℏ\u001fhcirc=ĥ\u001fhearts=♥\u001fheartsuit=♥\u001fhellip=…\u001fhercon=⊹\u001fhfr=𝔥\u001fhksearow=⤥\u001fhkswarow=⤦\u001fhoarr=⇿\u001fhomtht=∻\u001fhookleftarrow=↩\u001fhookrightarrow=↪\u001fhopf=𝕙\u001fhorbar=―\u001fhscr=𝒽\u001fhslash=ℏ\u001fhstrok=ħ\u001fhybull=⁃\u001fhyphen=‐\u001fiacute=í\u001fic=⁣\u001ficirc=î\u001ficy=и\u001fiecy=е\u001fiexcl=¡\u001fiff=⇔\u001fifr=𝔦\u001figrave=ì",
"ii=ⅈ\u001fiiiint=⨌\u001fiiint=∭\u001fiinfin=⧜\u001fiiota=℩\u001fijlig=ĳ\u001fimacr=ī\u001fimage=ℑ\u001fimagline=ℐ\u001fimagpart=ℑ\u001fimath=ı\u001fimof=⊷\u001fimped=Ƶ\u001fin=∈\u001fincare=℅\u001finfin=∞\u001finfintie=⧝\u001finodot=ı\u001fint=∫\u001fintcal=⊺\u001fintegers=ℤ\u001fintercal=⊺\u001fintlarhk=⨗\u001fintprod=⨼\u001fiocy=ё\u001fiogon=į\u001fiopf=𝕚\u001fiota=ι\u001fiprod=⨼\u001fiquest=¿\u001fiscr=𝒾\u001fisin=∈\u001fisinE=⋹\u001fisindot=⋵\u001fisins=⋴\u001fisinsv=⋳\u001fisinv=∈\u001fit=⁢\u001fitilde=ĩ\u001fiukcy=і\u001fiuml=ï\u001fjcirc=ĵ\u001fjcy=й\u001fjfr=𝔧\u001fjmath=ȷ",
"jopf=𝕛\u001fjscr=𝒿\u001fjsercy=ј\u001fjukcy=є\u001fkappa=κ\u001fkappav=ϰ\u001fkcedil=ķ\u001fkcy=к\u001fkfr=𝔨\u001fkgreen=ĸ\u001fkhcy=х\u001fkjcy=ќ\u001fkopf=𝕜\u001fkscr=𝓀\u001flAarr=⇚\u001flArr=⇐\u001flAtail=⤛\u001flBarr=⤎\u001flE=≦\u001flEg=⪋\u001flHar=⥢\u001flacute=ĺ\u001flaemptyv=⦴\u001flagran=ℒ\u001flambda=λ\u001flang=⟨\u001flangd=⦑\u001flangle=⟨\u001flap=⪅\u001flaquo=«\u001flarr=←\u001flarrb=⇤\u001flarrbfs=⤟\u001flarrfs=⤝\u001flarrhk=↩\u001flarrlp=↫\u001flarrpl=⤹\u001flarrsim=⥳\u001flarrtl=↢\u001flat=⪫\u001flatail=⤙\u001flate=⪭\u001flates=⪭︀\u001flbarr=⤌\u001flbbrk=❲",
"lbrace={\u001flbrack=[\u001flbrke=⦋\u001flbrksld=⦏\u001flbrkslu=⦍\u001flcaron=ľ\u001flcedil=ļ\u001flceil=⌈\u001flcub={\u001flcy=л\u001fldca=⤶\u001fldquo=“\u001fldquor=„\u001fldrdhar=⥧\u001fldrushar=⥋\u001fldsh=↲\u001fle=≤\u001fleftarrow=←\u001fleftarrowtail=↢\u001fleftharpoondown=↽\u001fleftharpoonup=↼\u001fleftleftarrows=⇇\u001fleftrightarrow=↔\u001fleftrightarrows=⇆\u001fleftrightharpoons=⇋\u001fleftrightsquigarrow=↭\u001fleftthreetimes=⋋\u001fleg=⋚\u001fleq=≤\u001fleqq=≦\u001fleqslant=⩽\u001fles=⩽\u001flescc=⪨\u001flesdot=⩿\u001flesdoto=⪁\u001flesdotor=⪃\u001flesg=⋚︀\u001flesges=⪓\u001flessapprox=⪅\u001flessdot=⋖\u001flesseqgtr=⋚\u001flesseqqgtr=⪋\u001flessgtr=≶\u001flesssim=≲\u001flfisht=⥼",
"lfloor=⌊\u001flfr=𝔩\u001flg=≶\u001flgE=⪑\u001flhard=↽\u001flharu=↼\u001flharul=⥪\u001flhblk=▄\u001fljcy=љ\u001fll=≪\u001fllarr=⇇\u001fllcorner=⌞\u001fllhard=⥫\u001flltri=◺\u001flmidot=ŀ\u001flmoust=⎰\u001flmoustache=⎰\u001flnE=≨\u001flnap=⪉\u001flnapprox=⪉\u001flne=⪇\u001flneq=⪇\u001flneqq=≨\u001flnsim=⋦\u001floang=⟬\u001floarr=⇽\u001flobrk=⟦\u001flongleftarrow=⟵\u001flongleftrightarrow=⟷\u001flongmapsto=⟼\u001flongrightarrow=⟶\u001flooparrowleft=↫\u001flooparrowright=↬\u001flopar=⦅\u001flopf=𝕝\u001floplus=⨭\u001flotimes=⨴\u001flowast=∗\u001flowbar=_\u001floz=◊\u001flozenge=◊\u001flozf=⧫\u001flpar=(\u001flparlt=⦓\u001flrarr=⇆",
"lrcorner=⌟\u001flrhar=⇋\u001flrhard=⥭\u001flrm=‎\u001flrtri=⊿\u001flsaquo=‹\u001flscr=𝓁\u001flsh=↰\u001flsim=≲\u001flsime=⪍\u001flsimg=⪏\u001flsqb=[\u001flsquo=‘\u001flsquor=‚\u001flstrok=ł\u001flt=<\u001fltcc=⪦\u001fltcir=⩹\u001fltdot=⋖\u001flthree=⋋\u001fltimes=⋉\u001fltlarr=⥶\u001fltquest=⩻\u001fltrPar=⦖\u001fltri=◃\u001fltrie=⊴\u001fltrif=◂\u001flurdshar=⥊\u001fluruhar=⥦\u001flvertneqq=≨︀\u001flvnE=≨︀\u001fmDDot=∺\u001fmacr=¯\u001fmale=♂\u001fmalt=✠\u001fmaltese=✠\u001fmap=↦\u001fmapsto=↦\u001fmapstodown=↧\u001fmapstoleft=↤\u001fmapstoup=↥\u001fmarker=▮\u001fmcomma=⨩\u001fmcy=м\u001fmdash=—",
"measuredangle=∡\u001fmfr=𝔪\u001fmho=℧\u001fmicro=µ\u001fmid=∣\u001fmidast=*\u001fmidcir=⫰\u001fmiddot=·\u001fminus=−\u001fminusb=⊟\u001fminusd=∸\u001fminusdu=⨪\u001fmlcp=⫛\u001fmldr=…\u001fmnplus=∓\u001fmodels=⊧\u001fmopf=𝕞\u001fmp=∓\u001fmscr=𝓂\u001fmstpos=∾\u001fmu=μ\u001fmultimap=⊸\u001fmumap=⊸\u001fnGg=⋙̸\u001fnGt=≫⃒\u001fnGtv=≫̸\u001fnLeftarrow=⇍\u001fnLeftrightarrow=⇎\u001fnLl=⋘̸\u001fnLt=≪⃒\u001fnLtv=≪̸\u001fnRightarrow=⇏\u001fnVDash=⊯\u001fnVdash=⊮\u001fnabla=∇\u001fnacute=ń\u001fnang=∠⃒\u001fnap=≉\u001fnapE=⩰̸\u001fnapid=≋̸\u001fnapos=ŉ\u001fnapprox=≉\u001fnatur=♮\u001fnatural=♮\u001fnaturals=ℕ",
"nbsp= \u001fnbump=≎̸\u001fnbumpe=≏̸\u001fncap=⩃\u001fncaron=ň\u001fncedil=ņ\u001fncong=≇\u001fncongdot=⩭̸\u001fncup=⩂\u001fncy=н\u001fndash=–\u001fne=≠\u001fneArr=⇗\u001fnearhk=⤤\u001fnearr=↗\u001fnearrow=↗\u001fnedot=≐̸\u001fnequiv=≢\u001fnesear=⤨\u001fnesim=≂̸\u001fnexist=∄\u001fnexists=∄\u001fnfr=𝔫\u001fngE=≧̸\u001fnge=≱\u001fngeq=≱\u001fngeqq=≧̸\u001fngeqslant=⩾̸\u001fnges=⩾̸\u001fngsim=≵\u001fngt=≯\u001fngtr=≯\u001fnhArr=⇎\u001fnharr=↮\u001fnhpar=⫲\u001fni=∋\u001fnis=⋼\u001fnisd=⋺\u001fniv=∋\u001fnjcy=њ\u001fnlArr=⇍\u001fnlE=≦̸\u001fnlarr=↚\u001fnldr=‥\u001fnle=≰",
"nleftarrow=↚\u001fnleftrightarrow=↮\u001fnleq=≰\u001fnleqq=≦̸\u001fnleqslant=⩽̸\u001fnles=⩽̸\u001fnless=≮\u001fnlsim=≴\u001fnlt=≮\u001fnltri=⋪\u001fnltrie=⋬\u001fnmid=∤\u001fnopf=𝕟\u001fnot=¬\u001fnotin=∉\u001fnotinE=⋹̸\u001fnotindot=⋵̸\u001fnotinva=∉\u001fnotinvb=⋷\u001fnotinvc=⋶\u001fnotni=∌\u001fnotniva=∌\u001fnotnivb=⋾\u001fnotnivc=⋽\u001fnpar=∦\u001fnparallel=∦\u001fnparsl=⫽⃥\u001fnpart=∂̸\u001fnpolint=⨔\u001fnpr=⊀\u001fnprcue=⋠\u001fnpre=⪯̸\u001fnprec=⊀\u001fnpreceq=⪯̸\u001fnrArr=⇏\u001fnrarr=↛\u001fnrarrc=⤳̸\u001fnrarrw=↝̸\u001fnrightarrow=↛\u001fnrtri=⋫\u001fnrtrie=⋭\u001fnsc=⊁\u001fnsccue=⋡\u001fnsce=⪰̸\u001fnscr=𝓃",
"nshortmid=∤\u001fnshortparallel=∦\u001fnsim=≁\u001fnsime=≄\u001fnsimeq=≄\u001fnsmid=∤\u001fnspar=∦\u001fnsqsube=⋢\u001fnsqsupe=⋣\u001fnsub=⊄\u001fnsubE=⫅̸\u001fnsube=⊈\u001fnsubset=⊂⃒\u001fnsubseteq=⊈\u001fnsubseteqq=⫅̸\u001fnsucc=⊁\u001fnsucceq=⪰̸\u001fnsup=⊅\u001fnsupE=⫆̸\u001fnsupe=⊉\u001fnsupset=⊃⃒\u001fnsupseteq=⊉\u001fnsupseteqq=⫆̸\u001fntgl=≹\u001fntilde=ñ\u001fntlg=≸\u001fntriangleleft=⋪\u001fntrianglelefteq=⋬\u001fntriangleright=⋫\u001fntrianglerighteq=⋭\u001fnu=ν\u001fnum=#\u001fnumero=№\u001fnumsp= \u001fnvDash=⊭\u001fnvHarr=⤄\u001fnvap=≍⃒\u001fnvdash=⊬\u001fnvge=≥⃒\u001fnvgt=>⃒\u001fnvinfin=⧞\u001fnvlArr=⤂\u001fnvle=≤⃒\u001fnvlt=<⃒\u001fnvltrie=⊴⃒",
"nvrArr=⤃\u001fnvrtrie=⊵⃒\u001fnvsim=∼⃒\u001fnwArr=⇖\u001fnwarhk=⤣\u001fnwarr=↖\u001fnwarrow=↖\u001fnwnear=⤧\u001foS=Ⓢ\u001foacute=ó\u001foast=⊛\u001focir=⊚\u001focirc=ô\u001focy=о\u001fodash=⊝\u001fodblac=ő\u001fodiv=⨸\u001fodot=⊙\u001fodsold=⦼\u001foelig=œ\u001fofcir=⦿\u001fofr=𝔬\u001fogon=˛\u001fograve=ò\u001fogt=⧁\u001fohbar=⦵\u001fohm=Ω\u001foint=∮\u001folarr=↺\u001folcir=⦾\u001folcross=⦻\u001foline=‾\u001folt=⧀\u001fomacr=ō\u001fomega=ω\u001fomicron=ο\u001fomid=⦶\u001fominus=⊖\u001foopf=𝕠\u001fopar=⦷\u001foperp=⦹\u001foplus=⊕\u001for=∨\u001forarr=↻\u001ford=⩝",
"order=ℴ\u001forderof=ℴ\u001fordf=ª\u001fordm=º\u001forigof=⊶\u001foror=⩖\u001forslope=⩗\u001forv=⩛\u001foscr=ℴ\u001foslash=ø\u001fosol=⊘\u001fotilde=õ\u001fotimes=⊗\u001fotimesas=⨶\u001fouml=ö\u001fovbar=⌽\u001fpar=∥\u001fpara=¶\u001fparallel=∥\u001fparsim=⫳\u001fparsl=⫽\u001fpart=∂\u001fpcy=п\u001fpercnt=%\u001fperiod=.\u001fpermil=‰\u001fperp=⊥\u001fpertenk=‱\u001fpfr=𝔭\u001fphi=φ\u001fphiv=ϕ\u001fphmmat=ℳ\u001fphone=☎\u001fpi=π\u001fpitchfork=⋔\u001fpiv=ϖ\u001fplanck=ℏ\u001fplanckh=ℎ\u001fplankv=ℏ\u001fplus=+\u001fplusacir=⨣\u001fplusb=⊞\u001fpluscir=⨢\u001fplusdo=∔\u001fplusdu=⨥",
"pluse=⩲\u001fplusmn=±\u001fplussim=⨦\u001fplustwo=⨧\u001fpm=±\u001fpointint=⨕\u001fpopf=𝕡\u001fpound=£\u001fpr=≺\u001fprE=⪳\u001fprap=⪷\u001fprcue=≼\u001fpre=⪯\u001fprec=≺\u001fprecapprox=⪷\u001fpreccurlyeq=≼\u001fpreceq=⪯\u001fprecnapprox=⪹\u001fprecneqq=⪵\u001fprecnsim=⋨\u001fprecsim=≾\u001fprime=′\u001fprimes=ℙ\u001fprnE=⪵\u001fprnap=⪹\u001fprnsim=⋨\u001fprod=∏\u001fprofalar=⌮\u001fprofline=⌒\u001fprofsurf=⌓\u001fprop=∝\u001fpropto=∝\u001fprsim=≾\u001fprurel=⊰\u001fpscr=𝓅\u001fpsi=ψ\u001fpuncsp= \u001fqfr=𝔮\u001fqint=⨌\u001fqopf=𝕢\u001fqprime=⁗\u001fqscr=𝓆\u001fquaternions=ℍ\u001fquatint=⨖\u001fquest=?",
"questeq=≟\u001fquot=\"\u001frAarr=⇛\u001frArr=⇒\u001frAtail=⤜\u001frBarr=⤏\u001frHar=⥤\u001frace=∽̱\u001fracute=ŕ\u001fradic=√\u001fraemptyv=⦳\u001frang=⟩\u001frangd=⦒\u001frange=⦥\u001frangle=⟩\u001fraquo=»\u001frarr=→\u001frarrap=⥵\u001frarrb=⇥\u001frarrbfs=⤠\u001frarrc=⤳\u001frarrfs=⤞\u001frarrhk=↪\u001frarrlp=↬\u001frarrpl=⥅\u001frarrsim=⥴\u001frarrtl=↣\u001frarrw=↝\u001fratail=⤚\u001fratio=∶\u001frationals=ℚ\u001frbarr=⤍\u001frbbrk=❳\u001frbrace=}\u001frbrack=]\u001frbrke=⦌\u001frbrksld=⦎\u001frbrkslu=⦐\u001frcaron=ř\u001frcedil=ŗ\u001frceil=⌉\u001frcub=}\u001frcy=р\u001frdca=⤷\u001frdldhar=⥩",
"rdquo=”\u001frdquor=”\u001frdsh=↳\u001freal=ℜ\u001frealine=ℛ\u001frealpart=ℜ\u001freals=ℝ\u001frect=▭\u001freg=®\u001frfisht=⥽\u001frfloor=⌋\u001frfr=𝔯\u001frhard=⇁\u001frharu=⇀\u001frharul=⥬\u001frho=ρ\u001frhov=ϱ\u001frightarrow=→\u001frightarrowtail=↣\u001frightharpoondown=⇁\u001frightharpoonup=⇀\u001frightleftarrows=⇄\u001frightleftharpoons=⇌\u001frightrightarrows=⇉\u001frightsquigarrow=↝\u001frightthreetimes=⋌\u001fring=˚\u001frisingdotseq=≓\u001frlarr=⇄\u001frlhar=⇌\u001frlm=‏\u001frmoust=⎱\u001frmoustache=⎱\u001frnmid=⫮\u001froang=⟭\u001froarr=⇾\u001frobrk=⟧\u001fropar=⦆\u001fropf=𝕣\u001froplus=⨮\u001frotimes=⨵\u001frpar=)\u001frpargt=⦔\u001frppolint=⨒\u001frrarr=⇉",
"rsaquo=›\u001frscr=𝓇\u001frsh=↱\u001frsqb=]\u001frsquo=’\u001frsquor=’\u001frthree=⋌\u001frtimes=⋊\u001frtri=▹\u001frtrie=⊵\u001frtrif=▸\u001frtriltri=⧎\u001fruluhar=⥨\u001frx=℞\u001fsacute=ś\u001fsbquo=‚\u001fsc=≻\u001fscE=⪴\u001fscap=⪸\u001fscaron=š\u001fsccue=≽\u001fsce=⪰\u001fscedil=ş\u001fscirc=ŝ\u001fscnE=⪶\u001fscnap=⪺\u001fscnsim=⋩\u001fscpolint=⨓\u001fscsim=≿\u001fscy=с\u001fsdot=⋅\u001fsdotb=⊡\u001fsdote=⩦\u001fseArr=⇘\u001fsearhk=⤥\u001fsearr=↘\u001fsearrow=↘\u001fsect=§\u001fsemi=;\u001fseswar=⤩\u001fsetminus=∖\u001fsetmn=∖\u001fsext=✶\u001fsfr=𝔰\u001fsfrown=⌢",
"sharp=♯\u001fshchcy=щ\u001fshcy=ш\u001fshortmid=∣\u001fshortparallel=∥\u001fshy=­\u001fsigma=σ\u001fsigmaf=ς\u001fsigmav=ς\u001fsim=∼\u001fsimdot=⩪\u001fsime=≃\u001fsimeq=≃\u001fsimg=⪞\u001fsimgE=⪠\u001fsiml=⪝\u001fsimlE=⪟\u001fsimne=≆\u001fsimplus=⨤\u001fsimrarr=⥲\u001fslarr=←\u001fsmallsetminus=∖\u001fsmashp=⨳\u001fsmeparsl=⧤\u001fsmid=∣\u001fsmile=⌣\u001fsmt=⪪\u001fsmte=⪬\u001fsmtes=⪬︀\u001fsoftcy=ь\u001fsol=/\u001fsolb=⧄\u001fsolbar=⌿\u001fsopf=𝕤\u001fspades=♠\u001fspadesuit=♠\u001fspar=∥\u001fsqcap=⊓\u001fsqcaps=⊓︀\u001fsqcup=⊔\u001fsqcups=⊔︀\u001fsqsub=⊏\u001fsqsube=⊑\u001fsqsubset=⊏\u001fsqsubseteq=⊑",
"sqsup=⊐\u001fsqsupe=⊒\u001fsqsupset=⊐\u001fsqsupseteq=⊒\u001fsqu=□\u001fsquare=□\u001fsquarf=▪\u001fsquf=▪\u001fsrarr=→\u001fsscr=𝓈\u001fssetmn=∖\u001fssmile=⌣\u001fsstarf=⋆\u001fstar=☆\u001fstarf=★\u001fstraightepsilon=ϵ\u001fstraightphi=ϕ\u001fstrns=¯\u001fsub=⊂\u001fsubE=⫅\u001fsubdot=⪽\u001fsube=⊆\u001fsubedot=⫃\u001fsubmult=⫁\u001fsubnE=⫋\u001fsubne=⊊\u001fsubplus=⪿\u001fsubrarr=⥹\u001fsubset=⊂\u001fsubseteq=⊆\u001fsubseteqq=⫅\u001fsubsetneq=⊊\u001fsubsetneqq=⫋\u001fsubsim=⫇\u001fsubsub=⫕\u001fsubsup=⫓\u001fsucc=≻\u001fsuccapprox=⪸\u001fsucccurlyeq=≽\u001fsucceq=⪰\u001fsuccnapprox=⪺\u001fsuccneqq=⪶\u001fsuccnsim=⋩\u001fsuccsim=≿\u001fsum=∑",
"sung=♪\u001fsup1=¹\u001fsup2=²\u001fsup3=³\u001fsup=⊃\u001fsupE=⫆\u001fsupdot=⪾\u001fsupdsub=⫘\u001fsupe=⊇\u001fsupedot=⫄\u001fsuphsol=⟉\u001fsuphsub=⫗\u001fsuplarr=⥻\u001fsupmult=⫂\u001fsupnE=⫌\u001fsupne=⊋\u001fsupplus=⫀\u001fsupset=⊃\u001fsupseteq=⊇\u001fsupseteqq=⫆\u001fsupsetneq=⊋\u001fsupsetneqq=⫌\u001fsupsim=⫈\u001fsupsub=⫔\u001fsupsup=⫖\u001fswArr=⇙\u001fswarhk=⤦\u001fswarr=↙\u001fswarrow=↙\u001fswnwar=⤪\u001fszlig=ß\u001ftarget=⌖\u001ftau=τ\u001ftbrk=⎴\u001ftcaron=ť\u001ftcedil=ţ\u001ftcy=т\u001ftdot=⃛\u001ftelrec=⌕\u001ftfr=𝔱\u001fthere4=∴\u001ftherefore=∴\u001ftheta=θ\u001fthetasym=ϑ\u001fthetav=ϑ",
"thickapprox=≈\u001fthicksim=∼\u001fthinsp= \u001fthkap=≈\u001fthksim=∼\u001fthorn=þ\u001ftilde=˜\u001ftimes=×\u001ftimesb=⊠\u001ftimesbar=⨱\u001ftimesd=⨰\u001ftint=∭\u001ftoea=⤨\u001ftop=⊤\u001ftopbot=⌶\u001ftopcir=⫱\u001ftopf=𝕥\u001ftopfork=⫚\u001ftosa=⤩\u001ftprime=‴\u001ftrade=™\u001ftriangle=▵\u001ftriangledown=▿\u001ftriangleleft=◃\u001ftrianglelefteq=⊴\u001ftriangleq=≜\u001ftriangleright=▹\u001ftrianglerighteq=⊵\u001ftridot=◬\u001ftrie=≜\u001ftriminus=⨺\u001ftriplus=⨹\u001ftrisb=⧍\u001ftritime=⨻\u001ftrpezium=⏢\u001ftscr=𝓉\u001ftscy=ц\u001ftshcy=ћ\u001ftstrok=ŧ\u001ftwixt=≬\u001ftwoheadleftarrow=↞\u001ftwoheadrightarrow=↠\u001fuArr=⇑\u001fuHar=⥣\u001fuacute=ú",
"uarr=↑\u001fubrcy=ў\u001fubreve=ŭ\u001fucirc=û\u001fucy=у\u001fudarr=⇅\u001fudblac=ű\u001fudhar=⥮\u001fufisht=⥾\u001fufr=𝔲\u001fugrave=ù\u001fuharl=↿\u001fuharr=↾\u001fuhblk=▀\u001fulcorn=⌜\u001fulcorner=⌜\u001fulcrop=⌏\u001fultri=◸\u001fumacr=ū\u001fuml=¨\u001fuogon=ų\u001fuopf=𝕦\u001fuparrow=↑\u001fupdownarrow=↕\u001fupharpoonleft=↿\u001fupharpoonright=↾\u001fuplus=⊎\u001fupsi=υ\u001fupsih=ϒ\u001fupsilon=υ\u001fupuparrows=⇈\u001furcorn=⌝\u001furcorner=⌝\u001furcrop=⌎\u001furing=ů\u001furtri=◹\u001fuscr=𝓊\u001futdot=⋰\u001futilde=ũ\u001futri=▵\u001futrif=▴\u001fuuarr=⇈\u001fuuml=ü\u001fuwangle=⦧\u001fvArr=⇕",
"vBar=⫨\u001fvBarv=⫩\u001fvDash=⊨\u001fvangrt=⦜\u001fvarepsilon=ϵ\u001fvarkappa=ϰ\u001fvarnothing=∅\u001fvarphi=ϕ\u001fvarpi=ϖ\u001fvarpropto=∝\u001fvarr=↕\u001fvarrho=ϱ\u001fvarsigma=ς\u001fvarsubsetneq=⊊︀\u001fvarsubsetneqq=⫋︀\u001fvarsupsetneq=⊋︀\u001fvarsupsetneqq=⫌︀\u001fvartheta=ϑ\u001fvartriangleleft=⊲\u001fvartriangleright=⊳\u001fvcy=в\u001fvdash=⊢\u001fvee=∨\u001fveebar=⊻\u001fveeeq=≚\u001fvellip=⋮\u001fverbar=|\u001fvert=|\u001fvfr=𝔳\u001fvltri=⊲\u001fvnsub=⊂⃒\u001fvnsup=⊃⃒\u001fvopf=𝕧\u001fvprop=∝\u001fvrtri=⊳\u001fvscr=𝓋\u001fvsubnE=⫋︀\u001fvsubne=⊊︀\u001fvsupnE=⫌︀\u001fvsupne=⊋︀\u001fvzigzag=⦚\u001fwcirc=ŵ\u001fwedbar=⩟\u001fwedge=∧\u001fwedgeq=≙",
"weierp=℘\u001fwfr=𝔴\u001fwopf=𝕨\u001fwp=℘\u001fwr=≀\u001fwreath=≀\u001fwscr=𝓌\u001fxcap=⋂\u001fxcirc=◯\u001fxcup=⋃\u001fxdtri=▽\u001fxfr=𝔵\u001fxhArr=⟺\u001fxharr=⟷\u001fxi=ξ\u001fxlArr=⟸\u001fxlarr=⟵\u001fxmap=⟼\u001fxnis=⋻\u001fxodot=⨀\u001fxopf=𝕩\u001fxoplus=⨁\u001fxotime=⨂\u001fxrArr=⟹\u001fxrarr=⟶\u001fxscr=𝓍\u001fxsqcup=⨆\u001fxuplus=⨄\u001fxutri=△\u001fxvee=⋁\u001fxwedge=⋀\u001fyacute=ý\u001fyacy=я\u001fycirc=ŷ\u001fycy=ы\u001fyen=¥\u001fyfr=𝔶\u001fyicy=ї\u001fyopf=𝕪\u001fyscr=𝓎\u001fyucy=ю\u001fyuml=ÿ\u001fzacute=ź\u001fzcaron=ž\u001fzcy=з",
"zdot=ż\u001fzeetrf=ℨ\u001fzeta=ζ\u001fzfr=𝔷\u001fzhcy=ж\u001fzigrarr=⇝\u001fzopf=𝕫\u001fzscr=𝓏\u001fzwj=‍\u001fzwnj=‌",
];
const NAMED_ENTS=new Map();
for(const piece of ENT_CHUNKS){ for(const pair of piece.split('\u001f')){ const eq=pair.indexOf('='); if(eq>0) NAMED_ENTS.set(pair.slice(0,eq),pair.slice(eq+1)); } }

// ---- escaping ----
// Fast paths first: strings without special characters come back untouched.
const ESC_ANY=/[&<>"']/, ESC_ATTR=/[&<>"]/;
function escapeText(s){ if(!ESC_ANY.test(s)) return s; return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
function escapeAttr(s){ if(!ESC_ATTR.test(s)) return s;
  let o='',i=0;
  while(i<s.length){ const c=s[i];
    if(c==='&'){ const m=/^&(#x[0-9a-fA-F]+|#X[0-9a-fA-F]+|#\d+|[A-Za-z][A-Za-z0-9]*);/.exec(s.slice(i,i+40));
      if(m){ if(m[1][0]==='#'){ const d=decodeNumeric(m[1]); if(d!==null){ o+=d; i+=m[0].length; continue; } } else { o+=m[0]; i+=m[0].length; continue; } }
      o+='&amp;'; i++; }
    else if(c==='<'){ o+='&lt;'; i++; } else if(c==='>'){ o+='&gt;'; i++; } else if(c==='"'){ o+='&quot;'; i++; } else { o+=c; i++; } }
  return o;
}
function escapeCode(s){ if(!ESC_ANY.test(s)) return s; return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
// Info strings on fenced code: entities stay as written, other & become &amp;.
function escapeInfo(s){
  let o='',i=0;
  while(i<s.length){ const c=s[i];
    if(c==='&'){ const m=/^&(#x[0-9a-fA-F]+|#\d+|[A-Za-z][A-Za-z0-9]+);/.exec(s.slice(i));
      if(m&&(m[1][0]==='#'||hasNamedEnt(m[1]))){ o+=m[0]; i+=m[0].length; continue; } o+='&amp;'; i++; }
    else if(c==='<'){ o+='&lt;'; i++; } else if(c==='>'){ o+='&gt;'; i++; } else { o+=c; i++; } }
  return o;
}
function normaliseHref(h){
  try{ h=encodeURI(h); }catch(e){ /* keep the raw value */ }
  return h.replace(/%25/g,'%');
}

// ---- reference labels: fold case, squash whitespace, expand ligatures ----
const FOLD_TABLE={'ß':'ss','ẞ':'ss','ﬀ':'ff','ﬁ':'fi','ﬂ':'fl','ﬃ':'ffi','ﬄ':'ffl','ﬅ':'st','ﬆ':'st'};
function foldRefLabel(s){ return s.replace(/[ßẞﬀﬁﬂﬃﬄﬅﬆ]/g,ch=>FOLD_TABLE[ch]).replace(/\s+/g,' ').trim().toLowerCase(); }

// ---- indentation helpers ----
// Drop k columns off the front; a tab crossing the cut is removed whole.
function dropColumns(s,k){
  let column=0,i=0;
  while(i<s.length&&column<k){ const c=s[i];
    if(c===' '){ column++; i++; }
    else if(c==='\t'){ const w=4-(column%4); if(column+w>k){ return s.slice(i+1); } column+=w; i++; }
    else break; }
  return s.slice(i);
}
function measureIndent(s){ let column=0,i=0; while(i<s.length){ const c=s[i]; if(c===' '){column++;i++;} else if(c==='\t'){column+=4-(column%4);i++;} else break; } return {n:column,i}; }
// Turn the tabs in a leading whitespace run into spaces (next tab stop = 4).
function expandTabsAt(s,col0){
  let column=col0, i=0, o='';
  while(i<s.length){ const c=s[i];
    if(c===' '){ o+=c; column++; i++; }
    else if(c==='\t'){ const w=4-(column%4); o+=' '.repeat(w); column+=w; i++; }
    else break; }
  return o+s.slice(i);
}

// ================= block openers =================
const BLOCK_TAG_NAMES=/^(?:address|article|aside|base|basefont|blockquote|body|caption|center|column|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h1|h2|h3|h4|h5|h6|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul)$/i;
function blankLine(s){ return /^[ \t]*$/.test(s); }
function matchAtx(s){ const dent=measureIndent(s); if(dent.n>3) return null; const text=s.slice(dent.i);
  const m=/^(#{1,6})(?:[ \t]+|$)/.exec(text); if(!m) return null;
  let body=text.slice(m[0].length);
  body=body.replace(/[ \t]+$/,'');
  if(/^#+$/.test(body)) body='';
  else body=body.replace(/[ \t]+#+$/,'');
  return {level:m[1].length, text:body};
}
function matchFence(s){ const dent=measureIndent(s); if(dent.n>3) return null; const text=s.slice(dent.i);
  const m=/^(`{3,}|~{3,})/.exec(text); if(!m) return null;
  const info=text.slice(m[1].length);
  if(m[1][0]==='`'&&info.includes('`')) return null; // backtick fences take no backticks in the info
  return {ch:m[1][0], len:m[1].length, info, ind:dent.n};
}
function matchRule(s){ const dent=measureIndent(s); if(dent.n>3) return false; const text=s.slice(dent.i).replace(/[ \t]/g,'');
  return text.length>=3&&/^([*_-])\1+$/.test(text);
}
function matchSetext(s){ const dent=measureIndent(s); if(dent.n>3) return 0; const text=s.slice(dent.i).replace(/[ \t]+$/,'');
  if(!text) return 0; if(/^\=+$/.test(text)) return 1; if(/^\-+$/.test(text)) return 2; return 0;
}
function matchHtml(s){
  const dent=measureIndent(s); if(dent.n>3) return 0; const text=s.slice(dent.i);
  if(!text.startsWith('<')) return 0;
  if(/^<(?:script|pre|style|textarea)(?:[ \t>]|$)/i.test(text)) return 1;
  if(text.startsWith('<!--')) return 2;
  if(text.startsWith('<?')) return 3;
  if(/^<![A-Za-z]/.test(text)) return 4;
  if(text.startsWith('<![CDATA[')) return 5;
  if(/^<\/?[A-Za-z][A-Za-z0-9-]*\s*\/?>/.test(text)||/^<\/?[A-Za-z][A-Za-z0-9-]*/.test(text)){
    const m=/^<\/?([A-Za-z][A-Za-z0-9-]*)/.exec(text);
    if(m&&BLOCK_TAG_NAMES.test(m[1])) return 6;
    // type 7: one complete tag and nothing but spaces after it
    const tag=readTag(s,dent.i);
    if(tag&&/^[ \t]*$/.test(s.slice(dent.i+tag.end))) return 7;
    return 0;
  }
  return 0;
}
function matchListMark(s){
  const dent=measureIndent(s); if(dent.n>3) return null; const text=s.slice(dent.i);
  const m=/^([*+-]|\d{1,9}[.)])/.exec(text); if(!m) return null;
  const marker=m[1]; const ordered=/\d/.test(marker[0]);
  let j=marker.length, column=dent.n+marker.length, spaces=0;
  if(j>=text.length) return {ordered, start:ordered?parseInt(marker):0, bullet:marker, bodyCol:column+1, empty:true, contentIdx:dent.i+j};
  if(text[j]!==' '&&text[j]!=='\t') return null;
  while(j<text.length&&(text[j]===' '||text[j]==='\t')){ if(text[j]===' '){ column++; spaces++; } else { const w=4-(column%4); column+=w; spaces+=w; } j++; }
  if(j>=text.length) return {ordered, start:ordered?parseInt(marker):0, bullet:marker, bodyCol:dent.n+marker.length+1, empty:true, contentIdx:dent.i+j};
  const bodyCol=spaces>=5?dent.n+marker.length+1:column;
  return {ordered, start:ordered?parseInt(marker):0, bullet:marker, bodyCol, empty:false, contentIdx:dent.i+j};
}
function readDelimRow(s){
  const parts=splitRow(s); if(!parts) return null;
  const aligns=[];
  for(const c of parts){ const text=c.trim(); const m=/^:?-+:?$/.test(text); if(!m) return null;
    aligns.push(text.startsWith(':')?(text.endsWith(':')?'center':'left'):(text.endsWith(':')?'right':null)); }
  return aligns;
}
function splitRow(line){
  let s=line.trim();
  if(s.startsWith('|')) s=s.slice(1);
  if(s.endsWith('|')&&!s.endsWith('\\|')) s=s.slice(0,-1);
  const parts=[]; let acc='', i=0;
  while(i<s.length){ const c=s[i];
    if(c==='\\'&&i+1<s.length&&(s[i+1]==='|'||s[i+1]==='\\')){ acc+=s[i+1]; i+=2; continue; }
    if(c==='|'){ parts.push(acc); acc=''; i++; continue; }
    acc+=c; i++;
  }
  parts.push(acc);
  return parts;
}

// ================= inline scanners =================
function isWordChar(ch){ const c=ch.charCodeAt(0); if(c<128) return (c>=48&&c<=57)||(c>=65&&c<=90)||(c>=97&&c<=122); return /[\p{L}\p{N}]/u.test(ch); }
function findClosingTicks(s,i,n,lim){ let j=i; while(j<lim){ const k=s.indexOf('`',j); if(k<0||k>=lim) return -1; let e=k; while(e<lim&&s[e]==='`') e++; if(e-k===n) return k; j=e; } return -1; }
function findPlain(s,i,ch){ let j=i; while(j<s.length){ const c=s[j]; if(c==='\\'){ j+=2; continue; } if(c===ch) return j; j++; } return -1; }

const TAIL_PUNCT='?!.,:;*_~\'"';
function trimTail(u){
  while(u.length){
    const c=u[u.length-1];
    if(c===')'){ let d=0; for(let i=0;i<u.length-1;i++){ if(u[i]==='(') d++; else if(u[i]===')'&&d>0) d--; } if(d<=0){ u=u.slice(0,-1); continue; } break; }
    if(c===';'){ const a=u.lastIndexOf('&'); if(a>=0){ const nm=u.slice(a+1,-1); if(/^#[0-9]+$/.test(nm)||/^#x[0-9a-fA-F]+$/.test(nm)||hasNamedEnt(nm)) break; } u=u.slice(0,-1); continue; }
    if(TAIL_PUNCT.includes(c)){ u=u.slice(0,-1); continue; }
    break;
  }
  // Cut at the first '(' that never closes, e.g. https://x.io/a(b -> https://x.io/a
  let d=0; const openParens=[];
  for(let i=0;i<u.length;i++){ if(u[i]==='('){ d++; openParens.push(i); } else if(u[i]===')'&&d>0){ d--; openParens.pop(); } }
  if(d>0) u=u.slice(0,openParens[0]);
  return u;
}
function looksLikeEntity(s,i){ // '&name;' / '&#123;' / '&#x1f;' starting at i
  if(s[i]!=='&') return false;
  const m=/^&(?:#[0-9]+|#x[0-9a-fA-F]+|[A-Za-z][A-Za-z0-9]*);/.exec(s.slice(i,i+40));
  return !!m;
}
function scanMail(s,i,uOpen){ // local@domain starting at i, or null
  const N=s.length;
  let j=i; while(j<N){ const c=s[j]; if(isWordChar(c)||'.!#$%&\'*+/=?^_`{|}~-'.includes(c)) j++; else break; }
  if(j>=N||s[j]!=='@') return null;
  let d=j+1, e=d; while(e<N){ const c=s[e]; if(isWordChar(c)||c==='-'||c==='.'||(c==='_'&&e+1<N&&isWordChar(s[e+1]))) e++; else break; }
  if(e<N&&s[e]==='_'&&!uOpen) return null; // '_' right after the domain voids it (unless a '__' closer is pending)
  let domain=s.slice(d,e).replace(/\.+$/,'');
  if(!domain||!/^[A-Za-z0-9_-]+(\.[A-Za-z0-9_-]+)*\.[A-Za-z_]+$/.test(domain)) return null;
  const u=s.slice(i,d+domain.length);
  return {href:'mailto:'+u, text:u, end:i+u.length};
}
function scanAutoLink(s,i,brk,hasLinkInside,uOpen){
  // GFM autolink at a word start; previous char is not a word char. Null if none.
  const N=s.length;
  if(s.startsWith('www.',i)){
    let j=i+4, k=j;
    while(k<N){ const c=s[k]; if((c>='a'&&c<='z')||(c>='A'&&c<='Z')||(c>='0'&&c<='9')||(c==='\\'&&s[k+1]==='\n')||'-._~:/?#@!$&\'()*+,;=%'.includes(c)){ if(c==='&'&&looksLikeEntity(s,k)) break; k++; } else break; }
    let u=s.slice(i,k);
    if(brk&&!hasLinkInside){ const b=u.indexOf(']'); if(b>=0) u=u.slice(0,b); }
    u=trimTail(u);
    const domain=u.slice(4).split(/[\/?#\\]/)[0];
    if(!/^[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/.test(domain)) return null;
    const suffix=domain.slice(domain.lastIndexOf('.')+1);
    if(!/^[A-Za-z]{2,}$/.test(suffix)) return null;
    return {href:'http://'+u, text:u, end:i+u.length};
  }
  // proto: form
  let m=/^[a-zA-Z][a-zA-Z0-9+.-]{1,31}:/.exec(s.slice(i,i+34));
  if(m){
    const proto=m[0].slice(0,-1).toLowerCase();
    if(proto==='mailto'||proto==='xmpp'){
      const mail=scanMail(s,i+m[0].length,uOpen);
      if(!mail) return null;
      let u=s.slice(i,mail.end);
      if(proto==='xmpp'){
        // at most one /resource segment
        let p=mail.end;
        if(p<N&&s[p]==='/'){ let q=p+1; while(q<N){ const c=s[q]; if(c===' '||c==='\t'||c==='\n'||c==='<'||c==='/') break; if(c==='&'&&looksLikeEntity(s,q)) break; q++; }
          if(q>p+1) u=s.slice(i,q); }
      }
      u=trimTail(u);
      return {href:u, text:u, end:i+u.length};
    }
    let j=i+m[0].length, k=j;
    const slashBreak=proto!=='http'&&proto!=='https'&&proto!=='ftp'; // only http/https/ftp keep a trailing backslash before a newline
    while(k<N){ const c=s[k]; if(c===' '||c==='\t'||c==='\n'||c==='<') break; if(c==='&'&&looksLikeEntity(s,k)) break; if(slashBreak&&c==='\\'&&s[k+1]==='\n') break; k++; }
    if(slashBreak&&k<N&&s[k]==='\\'&&s[k+1]==='\n') return null; // hard break after the URL voids it for other schemes
    let u=s.slice(i,k);
    if(brk&&!hasLinkInside){ const b=u.indexOf(']'); if(b>=0) u=u.slice(0,b); }
    u=trimTail(u);
    if(u.length<=m[0].length) return null;
    const rest=u.slice(m[0].length);
    if(!rest||!rest.split('').some(ch=>ch!=='\\')) return null; // proto followed only by backslashes is not a link
    return {href:u, text:u, end:i+u.length};
  }
  // bare email
  {
    const mail=scanMail(s,i,uOpen);
    if(mail) return mail;
  }
  return null;
}

// ---- raw HTML tags and link pieces ----
function readTag(s,i){
  // s[i]==='<'; returns {end, tag, isClose, name} or null
  const N=s.length; let j=i+1;
  if(j>=N) return null;
  if(s[j]==='!'){
    if(s.startsWith('!-->',j)||s.startsWith('!--->',j)){ const e=s.startsWith('!--->',j)?j+5:j+4; return {end:e,tag:s.slice(i,e),isClose:false,name:''}; }
    if(s.startsWith('!--',j)){ const e=s.indexOf('-->',j+3); if(e<0) return null; return {end:e+3,tag:s.slice(i,e+3),isClose:false,name:''}; }
    if(s.startsWith('![CDATA[',j)){ const e=s.indexOf(']]>',j+8); if(e<0) return null; return {end:e+3,tag:s.slice(i,e+3),isClose:false,name:''}; }
    const m=/^![A-Za-z][^>]*>/.exec(s.slice(j)); if(m) return {end:j+m[0].length,tag:s.slice(i,j+m[0].length),isClose:false,name:''};
    return null;
  }
  if(s[j]==='?'){ const e=s.indexOf('?>',j+1); if(e<0) return null; return {end:e+2,tag:s.slice(i,e+2),isClose:false,name:''}; }
  let closing=false; if(s[j]==='/'){ closing=true; j++; }
  const found=/^[A-Za-z][A-Za-z0-9-]*/.exec(s.slice(j)); if(!found) return null;
  const tagName=found[0]; j+=tagName.length;
  if(closing){ // closing tag: only spaces, then '>'
    let k=j; while(k<N&&(s[k]===' '||s[k]==='\t'||s[k]==='\n')) k++;
    if(k<N&&s[k]==='>') return {end:k+1,tag:s.slice(i,k+1),isClose:true,name:tagName.toLowerCase()};
    return null;
  }
  // opening tag: the char after the name must be space, '/' or '>'
  if(j<N&&s[j]!==' '&&s[j]!=='\t'&&s[j]!=='\n'&&s[j]!=='/'&&s[j]!=='>') return null;
  const attrLead=c=>/[A-Za-z_:]/.test(c), attrBody=c=>/[A-Za-z0-9_.:-]/.test(c);
  let k=j;
  const skipGap=()=>{ while(k<N&&(s[k]===' '||s[k]==='\t'||s[k]==='\n')) k++; };
  while(k<N){
    skipGap();
    if(k>=N) return null;
    const c=s[k];
    if(c==='>') return {end:k+1,tag:s.slice(i,k+1),isClose:false,name:tagName.toLowerCase()};
    if(c==='/'){ if(k+1<N&&s[k+1]==='>') return {end:k+2,tag:s.slice(i,k+2),isClose:false,name:tagName.toLowerCase()}; return null; }
    if(!attrLead(c)) return null;
    while(k<N&&attrBody(s[k])) k++;
    skipGap();
    if(k<N&&s[k]==='='){
      k++; skipGap();
      if(k>=N) return null;
      const q=s[k];
      if(q==='"'||q==="'"){ k++; while(k<N&&s[k]!==q) k++; if(k>=N) return null; k++;
        if(k<N&&s[k]!==' '&&s[k]!=='\t'&&s[k]!=='\n'&&s[k]!=='/'&&s[k]!=='>') return null; }
      else { // bare value: no space, quote, =, <, >, backtick
        let valStart=k; while(k<N&&!/[ \t\n"'=<>`]/.test(s[k])) k++; if(k===valStart) return null; }
    }
    // after an attribute the loop checks the next char again
  }
  return null;
}

function skipBlank(s,i){ while(i<s.length){ const c=s[i]; if(c===' '||c==='\t'||c==='\n') i++; else break; } return i; }
function readDest(s,i){ // link destination at i, or null
  const N=s.length; if(i>=N) return null;
  if(s[i]==='<'){ let j=i+1, o='';
    while(j<N&&s[j]!=='>'&&s[j]!=='\n'&&s[j]!=='<'){ if(s[j]==='\\'&&j+1<N&&PUNCT_RE.test(s[j+1])){ o+=s[j+1]; j+=2; continue; } o+=s[j]; j++; }
    if(j>=N||s[j]!=='>') return null; return {dest:o, end:j+1}; }
  let j=i, acc=null, nest=0;
  while(j<N){ const c=s[j];
    if(c==='\\'&&j+1<N&&PUNCT_RE.test(s[j+1])){ if(acc===null) acc=s.slice(i,j); acc+=s[j+1]; j+=2; continue; }
    if(c==='('){ nest++; if(acc!==null) acc+=c; j++; continue; }
    if(c===')'){ if(nest===0) break; nest--; if(acc!==null) acc+=c; j++; continue; }
    if(c===' '||c==='\t'||c==='\n') break;
    if(acc!==null) acc+=c; j++;
  }
  if(j===i) return null;
  return {dest:acc!==null?acc:s.slice(i,j), end:j};
}
function readTitle(s,i){ // quoted/bracketed title at i, or null
  const N=s.length; const q=s[i]; if(q!=='"'&&q!=="'"&&q!=='(') return null;
  const closing=q==='('?')':q; let j=i+1, o='';
  while(j<N){ const c=s[j];
    if(c==='\\'&&j+1<N&&(q!=='('?s[j+1]===q||PUNCT_RE.test(s[j+1]):PUNCT_RE.test(s[j+1]))){ o+=s[j+1]; j+=2; continue; }
    if(c===closing){ return {title:o, end:j+1}; }
    if(q==='('&&c==='(') return null;
    o+=c; j++;
  }
  return null;
}
function decodeEntities(s){ // numeric + named entities decoded (destinations, titles)
  let o='', i=0;
  while(i<s.length){ const c=s[i];
    if(c==='&'){ const m=/^&(#x[0-9a-fA-F]+|#\d+|[A-Za-z][A-Za-z0-9]+);/.exec(s.slice(i));
      if(m){ if(m[1][0]==='#') o+=decodeNumeric(m[1]); else if(hasNamedEnt(m[1])) o+=NAMED_ENTS.get(m[1]); else o+=m[0]; i+=m[0].length; continue; } o+=c; i++; }
    else { o+=c; i++; } }
  return o;
}
function resolveLink(s,j,rawText,defs){ // j = index just after ']'
  const N=s.length;
  if(j<N&&s[j]==='('){
    let k=skipBlank(s,j+1);
    if(k<N&&s[k]===')') return {href:'', title:'', end:k+1}; // empty destination
    const d=readDest(s,k);
    if(d){
      k=skipBlank(s,d.end);
      let title='';
      if(k<N&&s[k]!==')'){ const t=readTitle(s,k); if(t){ title=t.title; k=skipBlank(s,t.end); } else { /* fall through to shortcut */ } }
      if(k<N&&s[k]===')') return {href:d.dest, title:title, end:k+1};
    }
    // inline form failed: try the shortcut reference instead
    const key=foldRefLabel(rawText);
    if(!key) return null;
    const r=defs.get(key); if(!r) return null;
    return {href:r.href, title:r.title||'', end:j};
  }
  if(j<N&&s[j]==='['){
    const e=findPlain(s,j+1,']'); if(e<0) return null;
    let key=foldRefLabel(s.slice(j+1,e));
    if(!key) key=foldRefLabel(rawText); // collapsed [text][]
    if(!key) return null;
    const r=defs.get(key); if(!r) return null;
    return {href:r.href, title:r.title||'', end:e+1};
  }
  // shortcut / collapsed reference
  const key=foldRefLabel(rawText);
  if(!key) return null;
  const r=defs.get(key); if(!r) return null;
  return {href:r.href, title:r.title||'', end:j};
}

// ---- the inline scanner: one pass over a paragraph's text ----
function scanInline(s,links,state){
  const N=s.length, nodes=[]; let buf='', i=0;
  const brackets=[]; // open brackets: {at, start, isImg, tainted, tickAt, hasLink}
  let underOpen=false; // an unmatched '_' opener is pending (lets a mail link through before a '__' closer)
  const emitBuf=()=>{ if(buf){ nodes.push({t:'txt',s:buf}); buf=''; } };
  const pushTxt=(x)=>{ buf+=x; };
  while(i<N){
    const c=s[i];
    if(c==='\\'){
      if(i+1<N&&s[i+1]==='\n'){ emitBuf(); nodes.push({t:'brk'}); i+=2; continue; }
      if(i+1<N&&PUNCT_RE.test(s[i+1])){ buf+=s[i+1]; i+=2; continue; }
      buf+='\\'; i++; continue;
    }
    if(c==='`'){
      let n=0; while(i+n<N&&s[i+n]==='`') n++;
      const inBracket=brackets.length>0;
      let limit=N;
      if(inBracket){ const closeBracket=findPlain(s,i,']'); if(closeBracket>=0) limit=closeBracket; }
      const inLinkText=inBracket;
      let closeAt=-1;
      if(n>=2&&inLinkText) closeAt=findClosingTicks(s,i+n,n,limit);
      else if(n>=2) closeAt=findClosingTicks(s,i+n,n,N);
      else { // lone backtick
        if(inLinkText&&brackets[brackets.length-1].tainted) closeAt=findClosingTicks(s,i+1,1,limit);
        else closeAt=findClosingTicks(s,i+1,1,N);
      }
      if(closeAt<0){
        if(n>=2&&inLinkText) brackets[brackets.length-1].tainted=true;
        buf+='`'.repeat(n); i+=n; continue;
      }
      let spanText=s.slice(i+n,closeAt);
      spanText=spanText.replace(/\n/g,' ');
      if(spanText.length>1&&spanText[0]===' '&&spanText[spanText.length-1]===' '&&/[^\s]/.test(spanText)) spanText=spanText.slice(1,-1);
      emitBuf();
      const span={t:'code',s:spanText};
      nodes.push(span);
      if(inLinkText&&spanText.includes('`')) brackets[brackets.length-1].tickAt=nodes.length-1;
      i=closeAt+n; continue;
    }
    if(c==='*'||c==='_'||c==='~'){
      let n=0; while(i+n<N&&s[i+n]===c) n++;
      if(c==='~'&&n>=3){ buf+='~'.repeat(n); i+=n; continue; }
      const before=i>0?s[i-1]:'\n', after=i+n<N?s[i+n]:'\n';
      const prevSpace=isSpace(before), nextSpace=isSpace(after);
      const prevPunct=isPunct(before), nextPunct=isPunct(after);
      const opensHere=!nextSpace&&(!nextPunct||prevSpace||prevPunct), closesHere=!prevSpace&&(!prevPunct||nextSpace||nextPunct);
      let o,closeFlag;
      if(c==='_'){ o=opensHere&&(!closesHere||prevPunct); closeFlag=closesHere&&(!opensHere||nextPunct); if(o) underOpen=true; else if(closeFlag) underOpen=false; }
      else { o=opensHere; closeFlag=closesHere; }
      emitBuf(); nodes.push({t:'mark',c,n,o,canClose:closeFlag,afterSpace:after===' '||after==='\t'}); i+=n; continue;
    }
    if(c==='!'&&i+1<N&&s[i+1]==='['){
      emitBuf(); nodes.push({t:'open',img:true}); brackets.push({at:nodes.length-1,start:i+2,isImg:true,tainted:false,tickAt:-1,hasLink:false}); i+=2; continue;
    }
    if(c==='['){
      emitBuf(); nodes.push({t:'open',img:false}); brackets.push({at:nodes.length-1,start:i+1,isImg:false,tainted:false,tickAt:-1,hasLink:false}); i++; continue;
    }
    if(c===']'){
      if(!brackets.length){ buf+=']'; i++; continue; }
      const b=brackets[brackets.length-1];
      const labelText=s.slice(b.start,i);
      const lk=resolveLink(s,i+1,labelText,links);
      const freezeMarks=()=>{ if(b.tickAt>=0){ for(let k=b.at+1;k<nodes.length;k++){ const n=nodes[k]; if(n.t==='mark'){ n.t='txt'; n.s=n.c.repeat(n.n); delete n.c; delete n.n; delete n.o; delete n.closeAt; } } } };
      if(!lk){
        freezeMarks();
        brackets.pop(); // failed: the opener stays a literal '['
        buf+=']'; i++; continue;
      }
      // code span holding a backtick
      emitBuf();
      const inner=nodes.slice(b.at+1);
      const tickPos=b.tickAt>=0?b.tickAt-(b.at+1):-1;
      if(b.tickAt>=0&&tickPos!==inner.length-1){ freezeMarks(); brackets.pop(); buf+=']'; i++; continue; }
      // link text must not hold another link
      if(!b.isImg&&inner.some(n=>n.t==='link')){ freezeMarks(); brackets.pop(); buf+=']'; i++; continue; }
      nodes.length=b.at+1; // take the children out of the main list
      // a bare GFM autolink inside link text turns into plain text; an explicit <...> one stays a nested link
      for(let ci=0;ci<inner.length;ci++){ if(inner[ci].t==='auto'&&inner[ci].g) inner[ci]={t:'txt',s:inner[ci].text}; }
      const made={t:b.isImg?'img':'link',href:lk.href,title:lk.title||'',inner,noEm:b.tickAt>=0&&tickPos===inner.length-1,poison:b.tainted};
      nodes[b.at]=made;
      // inner open brackets now live inside this link
      while(brackets.length&&brackets[brackets.length-1].at>b.at) brackets.pop();
      brackets.pop();
      for(const bb of brackets) bb.hasLink=true; // every enclosing bracket now holds a link
      i=lk.end; continue;
    }
    if(c==='<'){
      const htmlTag=readTag(s,i);
      if(htmlTag){ emitBuf();
        if(htmlTag.isClose&&htmlTag.name==='a') state.inLink=false;
        else if(!htmlTag.isClose&&htmlTag.name==='a'&&htmlTag.tag.length>3&&htmlTag.tag[2]===' ') state.inLink=true;
        nodes.push({t:'raw',s:htmlTag.tag}); i=htmlTag.end; continue; }
      // <scheme:...> or <email> autolink
      const m=/^<([A-Za-z][A-Za-z0-9+.-]{1,31}:[^<>\s]*)>/.exec(s.slice(i,i+200))||/^<([A-Za-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*)>/.exec(s.slice(i,i+200));
      if(m){ emitBuf(); const txt=m[1]; const href=m[1].includes('@')&&!m[1].includes(':')?'mailto:'+txt:txt;
        nodes.push({t:'auto',href:normaliseHref(href),text:txt}); i+=m[0].length; continue; }
      buf+='<'; i++; continue;
    }
    if(c==='&'){
      const m=/^&(#x[0-9a-fA-F]+|#X[0-9a-fA-F]+|#\d+|[A-Za-z][A-Za-z0-9]*);/.exec(s.slice(i,i+40));
      if(m){
        if(m[1][0]==='#'){ const d=decodeNumeric(m[1]); if(d!==null){ buf+=d; i+=m[0].length; continue; } }
        else { emitBuf(); nodes.push({t:'ent',s:m[0]}); i+=m[0].length; continue; } // named refs pass through as written
      }
      buf+='&'; i++; continue;
    }
    if(c==='\n'){
      // hard break: two or more spaces before the newline — all trailing spaces go
      let spaces=0; for(let k=buf.length-1;k>=0&&buf[k]===' ';k--) spaces++;
      if(spaces>=2){ buf=buf.replace(/ +$/,''); emitBuf(); nodes.push({t:'brk'}); i++; continue; }
      buf+='\n'; i++; continue;
    }
    // GFM autolinks only at word starts
    if(!state.inLink&&isWordChar(c)&&(i===0||!isWordChar(s[i-1]))){
      const g=scanAutoLink(s,i,brackets.length>0,brackets.length?brackets[brackets.length-1].hasLink:false,underOpen);
      if(g){ emitBuf(); nodes.push({t:'auto',href:normaliseHref(g.href),text:g.text,g:1}); i=g.end; continue; }
    }
    buf+=c; i++;
  }
  emitBuf();
  return nodes;
}

// ---- emphasis / strikethrough: the CommonMark delimiter-stack algorithm ----
function applyEmphasis(nodes,taintAt){
  // Tainted-link rule: delimiters after a tainted link are frozen when a
  // code span comes after them in the same paragraph.
  if(taintAt>=0){
    let spotted=false;
    const laterCode=new Array(nodes.length).fill(false);
    for(let i=nodes.length-1;i>=0;i--){ laterCode[i]=spotted; const ni=nodes[i]; if(ni.t==='code') spotted=true; else if((ni.t==='link'||ni.t==='img')&&ni.inner&&ni.inner.some(k=>k.t==='code')) spotted=true; }
    for(let i=0;i<nodes.length;i++){ const n=nodes[i];
      if(n.t==='mark'&&i>taintAt&&laterCode[i]){ n.t='txt'; n.s=n.c.repeat(n.n); delete n.c; delete n.n; delete n.o; delete n.canClose; } }
  }
  const delims=[];
  for(let i=0;i<nodes.length;i++){ const n=nodes[i];
    if(n.t==='mark'){ n.usedOpen=0; n.usedClose=0; n.opens=[]; n.closes=[]; n.dead=false; delims.push(n); } }
  if(!delims.length) return nodes;
  const floorIdx={}, barred={};
  for(let di=0; di<delims.length; di++){
    const c=delims[di];
    if(c.dead||!c.canClose) continue;
    const bar=barred[c.c]||null, barActive=!!bar;
    while(c.n-c.usedOpen-c.usedClose>0){
      const floorAt=floorIdx[c.c]||0;
      let openAt=-1, anyPlain=false, deferred=-1;
      for(let scanAt=di-1; scanAt>=floorAt; scanAt--){
        const o=delims[scanAt];
        if(o.dead||o.c!==c.c||!o.o||o.n-o.usedOpen-o.usedClose<=0) continue;
        anyPlain=true;
        const openLeft=o.n-o.usedOpen-o.usedClose, closeLeft=c.n-c.usedOpen-c.usedClose, s=openLeft+closeLeft;
        if(bar&&scanAt<bar.idx){ // soft block: an inner em stops every outer match; an inner strong stops only an outer em
          const outerUse=(openLeft>=2&&closeLeft>=2)?2:1;
          if(bar.take===1||outerUse===1){
            let permit=false;
            // allowed only for the firstOne opener on hand, and only when the inner match is an em (a strong blocks an outer em outright)
            let firstOne=true;
            for(let ok=scanAt-1; ok>=floorAt; ok--){ const oo=delims[ok];
              if(!oo.dead&&oo.c===c.c&&oo.o&&oo.n-oo.usedOpen-oo.usedClose>0){ firstOne=false; break; } }
            if(firstOne&&bar.take===1&&(bar.lifted||(c.afterSpace&&closeLeft>=openLeft)||(closeLeft>=3&&openLeft>=2))) permit=true;
            if(!permit) continue;
          }
        }
        if((o.o&&o.canClose)||(c.o&&c.canClose)){
          if(s%3===0&&openLeft%3!==0&&closeLeft%3!==0) continue; } // rule of 3
        if(o.o&&o.canClose&&!c.o&&openLeft>=2&&closeLeft>=2&&c.afterSpace){ if(deferred<0) deferred=scanAt; continue; } // a close-only closer followed by space will not make a strong with a both-ways opener (unless it is the only opener)
        openAt=scanAt; break;
      }
      if(openAt<0&&deferred>=0) openAt=deferred;
      if(openAt<0){ if(!c.o&&!anyPlain&&!barActive) floorIdx[c.c]=di; break; }
      const o=delims[openAt];
      const take=(o.n-o.usedOpen-o.usedClose>=2&&c.n-c.usedOpen-c.usedClose>=2)?2:1;
      o.usedOpen+=take; c.usedClose+=take;
      o.opens.push({closer:c,take,sort:c.c==='~'?'del':take===2?'strong':'em'});
      c.closes.push({opener:o,take});
      if(c.o&&c.canClose&&o.o&&!o.canClose){ const pb=barred[c.c]; barred[c.c]={idx:Math.max(pb?pb.idx:0,openAt),take:Math.min(pb?pb.take:2,take)}; } // both-closer + open-only opener blocks earlier openers
      for(let k=openAt+1;k<di;k++) delims[k].dead=true; // delimiters staysIn a span cannot match later
    }
    if(c.afterSpace&&barred[c.c]) barred[c.c].lifted=true; // a closer followed by space/tab lifts the block for the firstOne opener only
  }
  // Walk the nodes and build the tree; leftover delimiters print literally.
  const out=[]; const stack=[];
  const nextMark=new Array(nodes.length).fill(-1);
  { let nx=-1; for(let i=nodes.length-1;i>=0;i--){ nextMark[i]=nx; if(nodes[i].t==='mark') nx=i; } }
  const delimPos=new Map(); for(let k=0;k<delims.length;k++) delimPos.set(delims[k],k);
  const cur=()=>stack.length?stack[stack.length-1].node.inner:out;
  for(let i=0;i<nodes.length;i++){
    const n=nodes[i];
    if(n.t==='mark'){
      const remain=n.n-n.usedOpen-n.usedClose;
      const nextIdx=nextMark[i];
      const take=n.closes.length>0?n.closes[0].take:0;
      let spanEm=false;
      if(take===2&&n.n>=3&&n.closes.length>0){
        const openAt=delimPos.get(n.closes[0].opener), di=delimPos.get(n);
        if(openAt!=null&&di!=null){ for(let k=openAt+1;k<di;k++){ const d=delims[k]; if(d.opens.some(m=>m.take===1)||d.closes.some(m=>m.take===1)){ spanEm=true; break; } } }
      }
      const staysIn=n.closes.length>0&&((nextIdx>=0&&nodes[nextIdx].c===n.c&&nodes[nextIdx].canClose)||(take===2&&n.n>=3&&spanEm)); // leftover stays staysIn when a same-char closer follows, or a 3+ strong whose span holds an em
      if(remain>0&&staysIn) cur().push({t:'txt',s:n.c.repeat(remain)});
      for(const pair of n.closes){
        for(let s=stack.length-1;s>=0;s--){
          if(stack[s].opener===pair.opener&&stack[s].take===pair.take){ stack.length=s; break; }
        }
      }
      if(remain>0&&!staysIn) cur().push({t:'txt',s:n.c.repeat(remain)});
      const openList=n.opens.slice().reverse(); // last-recorded (outermost) first
      for(const entry of openList){
        const elem={t:entry.sort,inner:[]};
        cur().push(elem);
        stack.push({node:elem,opener:n,take:entry.take});
      }
      continue;
    }
    cur().push(n);
  }
  return out;
}
function collectText(nodes){
  let o='';
  for(const n of nodes){
    if(n.t==='txt') o+=n.s;
    else if(n.t==='ent') o+=n.s;
    else if(n.t==='code') o+=n.s;
    else if(n.t==='brk') o+='\n';
    else if(n.t==='raw') o+='';
    else if(n.t==='auto') o+=n.text;
    else if(n.t==='link'||n.t==='img') o+=collectText(n.inner);
    else if(n.t==='em'||n.t==='strong'||n.t==='del') o+=collectText(n.inner);
    else if(n.t==='open') o+=n.img?'![':'[';
    else if(n.t==='mark') o+=n.c.repeat(n.n);
  }
  return o;
}
function emitInline(nodes,links,state){
  let o='';
  for(const n of nodes){
    if(n.t==='txt') o+=escapeText(n.s);
    else if(n.t==='ent') o+=n.s;
    else if(n.t==='code') o+='<code>'+escapeCode(n.s)+'</code>';
    else if(n.t==='brk') o+='<br>';
    else if(n.t==='raw') o+=n.s;
    else if(n.t==='auto') o+='<a href="'+escapeAttr(n.href)+'">'+escapeText(n.text)+'</a>';
    else if(n.t==='open') o+=n.img?'![':'[';
    else if(n.t==='mark') o+=escapeText(n.c.repeat(n.n));
    else if(n.t==='link'){
      const inner=n.noEm?n.inner:applyEmphasis(n.inner,-1);
      o+='<a href="'+escapeAttr(normaliseHref(n.href))+'"'+(n.title?' title="'+escapeAttr(n.title)+'"':'')+'>'+emitInline(inner,links,state)+'</a>';
    }
    else if(n.t==='img'){
      const alt=escapeAttr(collectText(applyEmphasis(n.inner,-1)));
      o+='<img src="'+escapeAttr(normaliseHref(n.href))+'" alt="'+alt+'"'+(n.title?' title="'+escapeAttr(n.title)+'"':'')+'>';
    }
    else if(n.t==='em') o+='<em>'+emitInline(n.inner,links,state)+'</em>';
    else if(n.t==='strong') o+='<strong>'+emitInline(n.inner,links,state)+'</strong>';
    else if(n.t==='del') o+='<del>'+emitInline(n.inner,links,state)+'</del>';
  }
  return o;
}
function renderInline(s,links,state){
  const nodes=scanInline(s,links,state);
  let taintAt=-1;
  for(let i=0;i<nodes.length;i++) if((nodes[i].t==='link'||nodes[i].t==='img')&&nodes[i].poison){ taintAt=i; break; }
  const done=applyEmphasis(nodes,taintAt);
  return emitInline(done,links,state);
}

// ================= block parser =================
class Doc{
  constructor(md){ this.source=md.replace(/\r\n?/g,'\n'); this.linkDefs=new Map(); this.inlineState={inLink:false}; this.trailingNewline=this.source.endsWith('\n'); }
  renderDocument(){
    let raw=this.source.split('\n');
    if(this.trailingNewline) raw.pop();
    const L=raw.map((s,i)=>({s,c:0,n:i,lz:false}));
    const nodes=this.readBlocks(L,0,L.length,{});
    return this.emitBlocks(nodes);
  }
  // Stitch paragraph rows back together: a hard break eats the next row's leading spaces.
  joinParaLines(rows){
    let o='';
    for(let i=0;i<rows.length;i++){
      let s=rows[i].s;
      if(rows[i].lz&&matchSetext(s)) s='    '+s; // a lazy setext underline stays as text, pushed in 4
      if(i>0){
        const above=rows[i-1].s;
        let slashes=0; for(let k=above.length-1;k>=0&&above[k]==='\\';k--) slashes++;
        if(slashes%2===1||/ {2,}$/.test(above)) s=s.replace(/^[ \t]+/,'');
        o+='\n';
      }
      o+=s;
    }
    return o;
  }
  readBlocks(L,a,b,ctx){
    const out=[]; let i=a;
    while(i<b){
      if(blankLine(L[i].s)){ i++; continue; }
      const row=L[i];
      const head=matchAtx(row.s);
      if(head){ out.push({k:'hd',level:head.level,text:head.text,_s:row.n,_e:row.n}); i++; continue; }
      const fence=matchFence(row.s);
      if(fence){
        const {node,ni,endHere}=this.readFenced(L,i,fence,ctx);
        out.push(node); i=ni; if(endHere) break; continue;
      }
      const htmlKind=matchHtml(row.s);
      if(htmlKind){
        const {node,ni}=this.readHtmlBlock(L,i,htmlKind,ctx);
        out.push(node); i=ni; continue;
      }
      if(matchRule(row.s)){ out.push({k:'hr',_s:row.n,_e:row.n}); i++; continue; }
      const dent=measureIndent(row.s);
      if(dent.n>=4){
        const {node,ni}=this.readIndented(L,i);
        out.push(node); i=ni; continue;
      }
      if(row.s.slice(dent.i).startsWith('>')){
        const {node,ni}=this.readQuote(L,i,ctx);
        out.push(node); i=ni; continue;
      }
      const mark=matchListMark(row.s);
      if(mark){
        const {node,ni}=this.readList(L,i,ctx);
        out.push(node); i=ni; continue;
      }
      // table: a header row plus a delimiter row; the header needs '|' or the delimiter a leading '|'
      if(i+1<b&&!blankLine(L[i+1].s)){
        const aligns=readDelimRow(L[i+1].s);
        if(aligns){ const heads=splitRow(L[i].s);
          if(heads&&heads.length===aligns.length&&(L[i].s.includes('|')||/^\s*\|/.test(L[i+1].s))){
            const {node,ni}=this.readTable(L,i,heads,aligns,ctx);
            out.push(node); i=ni; continue;
          }
        }
      }
      // paragraph (link reference definitions may lead it)
      const {node,ni}=this.readParagraph(L,i,ctx);
      if(node) out.push(node);
      i=ni;
    }
    return out;
  }
  readFenced(L,i,fence,ctx){
    const start=L[i].n; let j=i+1; const chunks=[]; const fenceInd=fence.ind;
    const itemCol=(ctx.itemCol!=null&&!ctx.inQuote)?ctx.itemCol:null;
    let begun=false;
    const infoText=fence.info.replace(/^[ \t]+/,'').replace(/[ \t]+$/,'').replace(/\\([!-\/:-@\[-`{-~])/g,'$1');
    const language=fence.ch==='`'&&infoText.includes('`')?'':infoText.split(/[ \t]/)[0]||'';
    while(j<L.length){
      const s=L[j].s;
      const dent=measureIndent(s);
      const t=s.slice(dent.i);
      const cm=/^(`{3,}|~{3,})/.exec(t);
      if(cm&&cm[1][0]===fence.ch&&cm[1].length>=fence.len&&dent.n<=3&&/^[ \t]*$/.test(t.slice(cm[1].length))){
        if(chunks.length&&chunks[chunks.length-1]==='') chunks.pop(); // one trailing blank line drops on close
        j++; break;
      }
      if(blankLine(s)){
        chunks.push(this.fenceContentLine(s,fenceInd,fence.ch)); j++; continue;
      }
      if(itemCol!=null&&!begun){
        if(L[j].lz){ return {node:{k:'code',fenced:true,lang:language,text:'',_s:start,_e:start}, ni:i+1, endHere:true}; }
        begun=true;
      } else if(!blankLine(s)) begun=true;
      chunks.push(this.fenceContentLine(s,fenceInd,fence.ch));
      j++;
    }
    let text=chunks.join('\n');
    if(chunks.length) text+='\n';
    return {node:{k:'code',fenced:true,lang:language,text,_s:start,_e:L[j-1].n}, ni:j};
  }
  fenceContentLine(s,ind,ch){ // backtick fences drop the fence indent; tilde fences keep lines verbatim
    return ch==='`'?dropColumns(s,ind):s;
  }
  readIndented(L,i){
    const start=L[i].n; const chunks=[];
    let j=i;
    while(j<L.length){
      const s=L[j].s;
      if(blankLine(s)){
        // a blank line counts only when the next non-blank line is indented code too
        let k=j+1; while(k<L.length&&blankLine(L[k].s)) k++;
        if(k<L.length&&measureIndent(L[k].s).n>=4){ while(j<k){ const bs=L[j].s; chunks.push(measureIndent(bs).n>=4?dropColumns(bs,4):''); j++; } continue; }
        break;
      }
      if(measureIndent(s).n<4) break;
      chunks.push(dropColumns(s,4));
      j++;
    }
    while(chunks.length&&chunks[chunks.length-1]==='') chunks.pop();
    let text=chunks.join('\n'); if(chunks.length) text+='\n';
    return {node:{k:'code',fenced:false,lang:'',text,_s:start,_e:L[j-1].n}, ni:j};
  }
  readHtmlBlock(L,i,htmlKind,ctx){
    const start=L[i].n; let j=i;
    const stopRe=htmlKind===1?/<\/(?:script|pre|style|textarea)>/i:htmlKind===2?/-->/:
      htmlKind===3?/\?>/:htmlKind===4?/>/:htmlKind===5?/\]\]>/:null;
    while(j<L.length){
      const s=L[j].s;
      if(stopRe&&stopRe.test(s)){ j++; break; }
      if(htmlKind>=6&&j>i&&blankLine(s)) break;
      j++;
    }
    const hasNext=j<L.length;
    const afterBlank=hasNext&&blankLine(L[j].s);
    const afterEmpty=hasNext&&L[j].s==='';
    let text=L.slice(i,j).map(x=>x.s).join('\n');
    let keepBreak=true;
    if(j>=L.length) keepBreak=this.trailingNewline;
    else if(htmlKind>=6) keepBreak=!afterBlank;
    else keepBreak=!afterEmpty;
    if(ctx&&((ctx.itemCol!=null)||ctx.inQuote)&&j>=L.length) keepBreak=false; // an html block ending a list item / quote drops its trailing newline
    if(keepBreak) text+='\n';
    return {node:{k:'html',text,_s:start,_e:L[j-1].n}, ni:j};
  }
  readQuote(L,i,ctx){
    const start=L[i].n; const rows=[]; let j=i;
    while(j<L.length){
      const s=L[j].s;
      if(blankLine(s)) break;
      const dent=measureIndent(s);
      if(dent.n<=3&&s.slice(dent.i).startsWith('>')){
        const markAt=dent.i;
        let body=expandTabsAt(s.slice(markAt+1), dent.n+1);
        if(body.startsWith(' ')) body=body.slice(1);
        rows.push({s:body, c:0, n:L[j].n, lz:false});
        j++; continue;
      }
      // Lazy continuation: only while the tail line is paragraph text, and
      // only when the line does not open a new block.
      if(rows.length&&!blankLine(rows[rows.length-1].s)&&!this.stopsParagraph(L,j,ctx)){
        // a lazy line cannot follow a non-paragraph block (indented code,
        // fenced code, atx, rule, html, list) that the tail line opened
        const tail=rows[rows.length-1].s;
        const gapBefore=rows.length<2||blankLine(rows[rows.length-2].s);
        if(gapBefore&&(measureIndent(tail).n>=4||matchAtx(tail)||matchFence(tail)||matchRule(tail)||matchHtml(tail))) break;
        // a lazy line cannot continue an unclosed fenced code block
        let inFence=false, fenceCh='', fenceLen=0;
        for(const row of rows){
          if(inFence){
            const innerDent=measureIndent(row.s), innerText=row.s.slice(innerDent.i);
            const closeRe=/^(`{3,}|~{3,})/.exec(innerText);
            if(closeRe&&closeRe[1][0]===fenceCh&&closeRe[1].length>=fenceLen&&innerDent.n<=3&&/^[ \t]*$/.test(innerText.slice(closeRe[1].length))) inFence=false;
            continue;
          }
          const fence=matchFence(row.s);
          if(fence){ inFence=true; fenceCh=fence.ch; fenceLen=fence.len; }
        }
        if(inFence) break;
        const dent=measureIndent(s);
        let lazyText=s;
        if(dent.n>=4) lazyText=dropColumns(s,4);
        rows.push({s:lazyText, c:0, n:L[j].n, lz:true});
        j++; continue;
      }
      break;
    }
    // a trailing whitespace-only line joins the paragraph (closeRe-241)
    if(rows.length>=2){
      const tail=rows[rows.length-1];
      if(tail.s.length>0&&blankLine(tail.s)&&!blankLine(rows[rows.length-2].s)) tail.trail=true;
    }
    const kids=this.readBlocks(rows,0,rows.length,{...ctx,nested:true,inQuote:true});
    return {node:{k:'quote',kids,_s:start,_e:L[j-1].n}, ni:j};
  }
  readParagraph(L,i,ctx){
    const start=L[i].n; const rows=[L[i]]; let j=i+1;
    // reference definitions at the paragraph start
    const foundDefs=this.harvestDefs(L,i);
    if(foundDefs){
      if(foundDefs.only){ return {node:null, ni:foundDefs.ni}; }
      // definitions eaten; the paragraph carries on after them
      return this.readParagraphTail(L,foundDefs.ni,ctx,foundDefs.consumed);
    }
    while(j<L.length){
      const s=L[j].s;
      if(blankLine(s)){ if(L[j].trail){ rows.push(L[j]); j++; } break; }
      if(L[j].lz){
        // lazy line: a setext underline stays as text (cm-093); other rows continue
        rows.push(L[j]); j++; continue;
      }
      const setext=matchSetext(s);
      if(setext&&rows.length){ // setext heading
        const text=this.joinParaLines(rows).trim();
        return {node:{k:'hd',level:setext,text:text,_s:start,_e:L[j].n}, ni:j+1};
      }
      if(this.stopsParagraph(L,j,ctx)) break;
      rows.push(L[j]); j++;
    }
    const text=this.joinParaLines(rows);
    return {node:{k:'pg',text:text,_s:start,_e:L[j-1].n}, ni:j};
  }
  readParagraphTail(L,i,ctx,consumed){
    // paragraph continuation from line i (definitions already eaten)
    const start=L[i].n; const rows=[L[i]]; let j=i+1;
    while(j<L.length){
      const s=L[j].s;
      if(blankLine(s)){ if(L[j].trail){ rows.push(L[j]); j++; } break; }
      if(L[j].lz){ rows.push(L[j]); j++; continue; }
      const setext=matchSetext(s);
      if(setext){ const text=this.joinParaLines(rows).trim();
        return {node:{k:'hd',level:setext,text:text,_s:start,_e:L[j].n}, ni:j+1}; }
      if(this.stopsParagraph(L,j,ctx)) break;
      rows.push(L[j]); j++;
    }
    const text=this.joinParaLines(rows);
    return {node:{k:'pg',text:text,_s:start,_e:L[j-1].n}, ni:j};
  }
  stopsParagraph(L,j,ctx){
    const s=L[j].s;
    if(matchAtx(s)||matchFence(s)||matchRule(s)) return true;
    const htmlKind=matchHtml(s); if(htmlKind>=1&&htmlKind<=6) return true;
    const dent=measureIndent(s);
    if(dent.n<=3&&s.slice(dent.i).startsWith('>')) return true;
    const mark=matchListMark(s);
    if(mark){ if(mark.empty) return false; if(!mark.ordered) return true; if(mark.start===1||ctx.nested) return true; }
    // a table header + delimiter interrupts too
    if(j+1<L.length&&!blankLine(L[j+1].s)){
      const aligns=readDelimRow(L[j+1].s);
      if(aligns){ const heads=splitRow(s); if(heads&&heads.length===aligns.length&&(s.includes('|')||/^\s*\|/.test(L[j+1].s))) return true; }
    }
    return false;
  }
  harvestDefs(L,i){
    // gather the candidate paragraph lines
    const pool=[L[i]]; let j=i+1;
    while(j<L.length){
      const s=L[j].s;
      if(blankLine(s)) break;
      if(L[j].lz){ pool.push(L[j]); j++; continue; }
      if(matchSetext(s)) break;
      if(this.stopsParagraph(L,j,{})) break;
      pool.push(L[j]); j++;
    }
    const joined=pool.map(x=>x.s).join('\n');
    let at=0, count=0, usedUp=0;
    while(at<joined.length){
      let indent=0, p=at;
      while(p<joined.length&&(joined[p]===' '||joined[p]==='\joined')){ if(joined[p]===' '){indent++;}else{indent+=4-(indent%4);} p++; if(indent>3) break; }
      if(indent>3||p>=joined.length||joined[p]!=='[') break;
      const e=findPlain(joined,p+1,']'); if(e<0) break;
      const label=joined.slice(p+1,e);
      if(!label||label.length>999) break;
      let hasBracket=false; for(let bi=0;bi<label.length;bi++){ if(label[bi]==='\\'){ bi++; continue; } if(label[bi]==='['){ hasBracket=true; break; } }
      if(hasBracket) break;
      if(joined[e+1]!==':') break;
      let q=skipBlank(joined,e+2);
      const d=readDest(joined,q); if(!d) break;
      let title='';
      let r=d.end;
      while(r<joined.length&&(joined[r]===' '||joined[r]==='\joined')) r++;
      if(r<joined.length&&joined[r]!=='\n'){
        if(r===d.end) break; // a title needs whitespace after the destination
        const ttl=readTitle(joined,r); if(!ttl) break;
        title=ttl.title; r=ttl.end;
        while(r<joined.length&&(joined[r]===' '||joined[r]==='\joined')) r++;
        if(r<joined.length&&joined[r]!=='\n') break;
      } else if(r<joined.length&&joined[r]==='\n'){
        // optional title on the next line (any indent)
        let t3=r+1;
        while(t3<joined.length&&(joined[t3]===' '||joined[t3]==='\joined')) t3++;
        if(t3<joined.length&&(joined[t3]==='"'||joined[t3]==="'"||joined[t3]==='(')){
          const ttl=readTitle(joined,t3);
          if(ttl){
            let t4=ttl.end;
            while(t4<joined.length&&(joined[t4]===' '||joined[t4]==='\joined')) t4++;
            if(t4>=joined.length||joined[t4]==='\n'){ title=ttl.title; r=t4; }
            // otherwise this is not a title line; the definition ends at the destination line
          }
        }
      }
      // a valid definition
      const folded=foldRefLabel(label);
      if(!folded) break;
      if(!this.linkDefs.has(folded)) this.linkDefs.set(folded,{href:d.dest,title});
      count++;
      at=r;
      if(at<joined.length&&joined[at]==='\n') at++;
      usedUp=at;
      // carry on to the next line
    }
    if(!count) return null;
    const head=joined.slice(0,usedUp);
    let usedLines=(head.match(/\n/g)||[]).length;
    if(head.length&&!head.endsWith('\n')) usedLines++;
    const nextLine=i+usedLines;
    if(nextLine>=i+pool.length) return {only:true, ni:i+pool.length, consumed:count};
    return {only:false, ni:nextLine, consumed:count};
  }
  readList(L,i,ctx){
    const start=L[i].n; const headMark=matchListMark(L[i].s);
    const ordered=headMark.ordered; const collected=[]; let j=i;
    const sep=ordered?headMark.bullet.slice(-1):headMark.bullet;
    let isLoose=false;
    while(j<L.length){
      const s=L[j].s;
      if(matchRule(s)) break; // a thematic break ends the list
      if(blankLine(s)){
        // blank: look ahead — a sibling marker or a continuation follows?
        let k=j+1; while(k<L.length&&blankLine(L[k].s)) k++;
        if(k>=L.length) { j=k; break; }
        const mark2=matchListMark(L[k].s);
        if(mark2&&measureIndent(L[k].s).n<=3&&mark2.ordered===ordered&&(ordered?mark2.bullet.slice(-1)===sep:mark2.bullet===sep)){ j=k; isLoose=true; continue; }
        if(collected.length&&measureIndent(L[k].s).n>=collected[collected.length-1].bodyCol){ j=k; isLoose=true; continue; }
        break;
      }
      const mark=matchListMark(s);
      const dent=measureIndent(s);
      if(mark&&collected.length&&dent.n<=3){
        if(mark.ordered!==ordered) break;
        if(ordered?mark.bullet.slice(-1)!==sep:mark.bullet!==sep) break; // a different bullet/delimiter starts a new list
        // sibling marker
      } else if(mark&&!collected.length){
        // headMark item (already known)
      } else if(!collected.length){
        break;
      } else {
        break; // this line does not belong to the list
      }
      // open a new item at line j
      const marker=matchListMark(s);
      const bodyCol=marker.bodyCol;
      const itemFirst=L[j].n;
      const itemRows=[];
      let itemGap=false;
      // headMark line content
      let openFence=null, fenceBegun=false;
      if(!marker.empty){
        const textAt=marker.contentIdx!=null?marker.contentIdx:dent.i+marker.bullet.length;
        // expand the tabs in the gap after the marker, then take content at bodyCol
        const markCol=dent.n+marker.bullet.length;
        const gap=s.slice(dent.i+marker.bullet.length, textAt);
        const gapExp=expandTabsAt(gap, markCol);
        const headText=gapExp.slice(Math.max(0,bodyCol-markCol))+s.slice(textAt);
        itemRows.push({s:headText, c:bodyCol, n:L[j].n, lz:false});
        const fence0=matchFence(headText);
        if(fence0) openFence={ch:fence0.ch,len:fence0.len};
      }
      j++;
      let itemLast=itemFirst;
      while(j<L.length){
        const line2=L[j].s;
        if(blankLine(line2)){
          if(openFence){ itemRows.push({s:'',c:0,n:L[j].n,lz:false}); j++; continue; }
          let k=j+1; while(k<L.length&&blankLine(L[k].s)) k++;
          if(k>=L.length){ j=k; break; }
          const dent2=measureIndent(L[k].s);
          const mark2=matchListMark(L[k].s);
          const sibling=mark2&&dent2.n<=3&&dent2.n<bodyCol&&mark2.ordered===ordered&&(ordered?mark2.bullet.slice(-1)===sep:mark2.bullet===sep);
          const keepsGoing=dent2.n>=bodyCol||sibling;
          if(!keepsGoing) break;
          if(itemRows.length===0) break; // a blank closes an item with no content yet
          // blank lines belong to the item
          while(j<k){ itemRows.push({s:'',c:0,n:L[j].n,lz:false}); j++; }
          // only a blank followed by a block at this item's own level loosens
          // the list (a blank inside a nested list does not loosen the outer one)
          const cutK=dropColumns(expandTabsAt(L[k].s,0),bodyCol);
          const nestedMark=dent2.n>=bodyCol&&matchListMark(cutK);
          if(sibling||(!nestedMark&&dent2.n-bodyCol<2)) itemGap=true;
          continue;
        }
        const dent2=measureIndent(line2);
        const mark2=matchListMark(line2);
        if(mark2&&dent2.n<=3&&dent2.n<bodyCol){
          break; // any marker below the content indent ends the item
        }
        if(openFence){
          const relText=line2.slice(Math.min(dent2.i, line2.length));
          const closeRe2=/^(`{3,}|~{3,})/.exec(relText);
          const closes=closeRe2&&closeRe2[1][0]===openFence.ch&&closeRe2[1].length>=openFence.len&&/^[ \t]*$/.test(relText.slice(closeRe2[1].length));
          if(closes){ itemRows.push({s:dropColumns(expandTabsAt(line2,0),bodyCol),c:bodyCol,n:L[j].n,lz:false}); itemLast=L[j].n; j++; openFence=null; fenceBegun=false; continue; }
          if(!fenceBegun){
            if(dent2.n>=bodyCol){ fenceBegun=true; itemRows.push({s:dropColumns(expandTabsAt(line2,0),bodyCol),c:bodyCol,n:L[j].n,lz:false}); itemLast=L[j].n; j++; continue; }
            break; // headMark non-blank line below the indent: the fence stays empty, the item ends here
          }
          itemRows.push({s:dropColumns(expandTabsAt(line2,0),bodyCol),c:bodyCol,n:L[j].n,lz:false});
          itemLast=L[j].n; j++; continue;
        }
        if(dent2.n>=bodyCol){
          const cut=dropColumns(expandTabsAt(line2,0),bodyCol);
          const fence2=matchFence(cut);
          if(fence2) openFence={ch:fence2.ch,len:fence2.len};
          itemRows.push({s:cut, c:bodyCol, n:L[j].n, lz:false});
          itemLast=L[j].n; j++; continue;
        }
        // lazy continuation: paragraph text inside the item, unless item opens a block
        const lastFull=itemRows.length?itemRows[itemRows.length-1]:null;
        if(lastFull&&!blankLine(lastFull.s)&&!this.stopsParagraph(L,j,{nested:true})){
          let lazyText=line2;
          if(dent2.n>=4) lazyText=dropColumns(line2,4);
          itemRows.push({s:lazyText, c:0, n:L[j].n, lz:true});
          itemLast=L[j].n; j++; continue;
        }
        break;
      }
      collected.push({lines:itemRows, bodyCol, startN:itemFirst, endN:itemLast, blankAfter:itemGap});
    }
    // sub-parse the collected, then work out looseness
    const done=[];
    for(const item of collected){
      const kids=this.readBlocks(item.lines,0,item.lines.length,{nested:true,itemCol:item.bodyCol});
      done.push({kids, ...item});
    }
    for(let x=0;x<done.length;x++){
      const kids=done[x].kids;
      for(let y=1;y<kids.length;y++){ if(kids[y]._s>kids[y-1]._e+1){ isLoose=true; } }
    }
    for(let x=1;x<done.length;x++){ if(done[x].startN>done[x-1].endN+1) isLoose=true; }
    for(const item of done){ if(item.blankAfter) isLoose=true; }
    return {node:{k:'list',ordered,start:ordered?headMark.start:0,loose:isLoose,items:done,_s:start,_e:L[j-1]?L[j-1].n:start}, ni:j};
  }
  readTable(L,i,hd,dl,ctx){
    const start=L[i].n; const rows=[]; let j=i+2;
    while(j<L.length){
      const s=L[j].s;
      if(/^ *$/.test(s)) break; // empty / spaces-only ends the table
      if(this.stopsTable(s)) break; // a block start (incl. list marker) ends the table
      rows.push(splitRow(s));
      j++;
    }
    return {node:{k:'table',head:hd,aligns:dl,rows,_s:start,_e:L[j-1].n}, ni:j};
  }
  stopsTable(s){
    const ind=measureIndent(s);
    if(ind.n>3) return false;
    const t=s.slice(ind.i);
    if(t.startsWith('>')||matchAtx(s)||matchFence(s)||matchRule(s)||matchHtml(s)) return true;
    if(matchListMark(s)) return true;
    return false;
  }
  emitBlocks(nodes){
    let o='';
    for(const n of nodes){
      if(n.k==='hd'){ o+='<h'+n.level+'>'+renderInline(n.text,this.linkDefs,this.inlineState)+'</h'+n.level+'>\n'; }
      else if(n.k==='pg'){ o+='<p>'+renderInline(n.text,this.linkDefs,this.inlineState)+'</p>\n'; }
      else if(n.k==='code'){
        if(n.fenced) o+='<pre><code'+(n.lang?' class="language-'+escapeInfo(n.lang)+'"':'')+'>'+escapeCode(n.text)+'</code></pre>\n';
        else o+='<pre><code>'+escapeCode(n.text)+'</code></pre>\n';
      }
      else if(n.k==='hr'){ o+='<hr>\n'; }
      else if(n.k==='html'){ o+=n.text; }
      else if(n.k==='quote'){ o+='<blockquote>\n'+this.emitBlocks(n.kids)+'</blockquote>\n'; }
      else if(n.k==='list'){ o+=this.emitList(n); }
      else if(n.k==='table'){ o+=this.emitTable(n); }
    }
    return o;
  }
  emitList(n){
    let o=n.ordered?'<ol'+(n.start!==1?' start="'+n.start+'"':'')+'>\n':'<ul>\n';
    for(const item of n.items){
      const chunks=[];
      for(const c of item.kids){
        if(c.k==='pg') chunks.push(n.loose?'<p>'+this.renderTaskText(c)+'</p>':this.renderTaskText(c));
        else chunks.push(this.emitBlocks([c]));
      }
      let text='';
      if(n.loose){
        for(let idx=0;idx<chunks.length;idx++){ const prev=idx>0?item.kids[idx-1]:null; if(text&&!text.endsWith('\n')&&!(prev&&prev.k==='html')) text+='\n'; text+=chunks[idx]; }
        const last=item.kids[item.kids.length-1];
        if(text&&!text.endsWith('\n')&&!(last&&last.k==='html')) text+='\n';
      } else {
        text=chunks.join('');
      }
      o+='<li>'+text+'</li>\n';
    }
    o+=n.ordered?'</ol>\n':'</ul>\n';
    return o;
  }
  renderTaskText(para){
    const m=/^\[([ xX])\] ([\s\S]*)$/.exec(para.text);
    if(m){ const box=m[1]===' '?
      '<input disabled="" type="checkbox">':
      '<input checked="" disabled="" type="checkbox">';
      return box+' '+renderInline(m[2],this.linkDefs,this.inlineState);
    }
    return renderInline(para.text,this.linkDefs,this.inlineState);
  }
  emitTable(n){
    let o='<table>\n<thead>\n<tr>\n';
    for(let i=0;i<n.head.length;i++){
      const a=n.aligns[i];
      o+='<th'+(a?' align="'+a+'"':'')+'>'+renderInline(n.head[i].trim(),this.linkDefs,this.inlineState)+'</th>\n';
    }
    o+='</tr>\n</thead>\n';
    if(n.rows.length){
      o+='<tbody>';
      for(const r of n.rows){
        o+='<tr>\n';
        for(let i=0;i<n.head.length;i++){
          const a=n.aligns[i];
          const cellText=i<r.length?r[i]:'';
          o+='<td'+(a?' align="'+a+'"':'')+'>'+renderInline(cellText.trim(),this.linkDefs,this.inlineState)+'</td>\n';
        }
        o+='</tr>\n';
      }
      o+='</tbody></table>\n';
    } else {
      o+='</table>\n';
    }
    return o;
  }
}
