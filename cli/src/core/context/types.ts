import type { NormalizedMessage } from '../providers/types.js';
export type SourceClass='application'|'user'|'workspace'|'artifact'|'tool-result'|'specialist'|'remote-provider'|'system';
export type TrustClassification='trusted-instruction'|'trusted-schema'|'untrusted-data'|'instruction-inert'|'unknown';
export type InclusionMode='verbatim'|'summarized'|'compacted'|'pinned'|'protected'|'excluded'|'unavailable'|'required'|'recent'|'evidence'|'summary'|'omitted';
export type MeasurementQuality='estimated'|'provider-reported'|'locally-measured'|'fallback'|'unknown'|'percentage unavailable';
export type OmissionReason='capacity'|'untrusted'|'duplicate'|'superseded'|'not-selected'|'protected-overflow'|'invalid';
export type UtilizationBand='green'|'amber'|'orange'|'red'|'percentage unavailable';
export interface ContextSource{readonly sourceClass:SourceClass;readonly trust:TrustClassification;readonly provenance:string;readonly sourceId?:string;readonly digest?:string}
export interface ContextTransformation{readonly kind:'selected'|'delimited'|'summarized'|'compacted'|'omitted';readonly at:string;readonly reason?:string;readonly sourceIds?:readonly string[]}
export interface ContextItem{readonly id:string;readonly role:NormalizedMessage['role'];readonly content:string;readonly source:ContextSource;readonly inclusion:InclusionMode;readonly protected:boolean;readonly estimatedTokens:number;readonly measuredBytes:number;readonly measurementQuality:MeasurementQuality;readonly omissionReason?:OmissionReason;readonly transformations:readonly ContextTransformation[];readonly pinId?:string}
export interface ContextCapacity{readonly rawLimit:number|null;readonly effective:number|'percentage unavailable';readonly responseReserve:number|'percentage unavailable';readonly safetyMargin:number|'percentage unavailable';readonly configuredMaxOutput:number;readonly measurementQuality:MeasurementQuality}
export interface ContextUtilization{readonly tokens:number;readonly capacity:number|'percentage unavailable';readonly percent:number|'percentage unavailable';readonly band:UtilizationBand}
export interface ContextDecision{readonly itemId:string;readonly included:boolean;readonly mode:InclusionMode;readonly reason?:OmissionReason;readonly provenance:string}
export interface ContextBuildResult{readonly messages:readonly NormalizedMessage[];readonly items:readonly ContextItem[];readonly estimatedTokens:number;readonly utilization:ContextUtilization;readonly capacity:ContextCapacity;readonly omissions:readonly ContextItem[];readonly transformations:readonly ContextTransformation[]}
export interface ContextBuilderInput{readonly history:readonly NormalizedMessage[];readonly newInput:string;readonly sessionId?:string;readonly now?:string;readonly capacity?:ContextCapacity;readonly pins?:readonly {readonly target:{readonly itemId:string;readonly transcriptIdentity:string};readonly status:string}[]}
export interface ContextBuilder{build(input:ContextBuilderInput):ContextBuildResult}
export function validCapacity(raw:number|null,output=0):raw is number{return raw!==null&&Number.isFinite(raw)&&raw>0&&Number.isFinite(output)&&output>=0}
export function effectiveContextCapacity(raw:number,output=0):number{return validCapacity(raw,output)?Math.max(0,raw-Math.max(output,Math.ceil(raw*.08))-Math.max(2048,Math.ceil(raw*.02))):0}
export function effectiveContextCapacityOrUnavailable(raw:number|null,output=0):number|'percentage unavailable'{return validCapacity(raw,output)?effectiveContextCapacity(raw,output):'percentage unavailable'}
export function contextUtilizationPercent(tokens:number,capacity:number):number{return capacity>0?Math.round(tokens/capacity*100):100}
export function contextUtilizationPercentOrUnavailable(tokens:number,capacity:number|'percentage unavailable'):number|'percentage unavailable'{return capacity==='percentage unavailable'?capacity:contextUtilizationPercent(tokens,capacity)}
export function utilizationBand(p:number|'percentage unavailable'):UtilizationBand{return p==='percentage unavailable'?p:p<70?'green':p<85?'amber':p<95?'orange':'red'}
