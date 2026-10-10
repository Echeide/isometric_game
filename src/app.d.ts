import type {Principal} from '$lib/platform/types';
declare global {namespace App {interface Locals {
   locale?:import('./lib/i18n/locale').UiLocale;characterWorkshopAuthorized?:boolean;principal?:Principal|null}}}
export {};
