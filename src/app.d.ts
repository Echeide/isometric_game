import type {Principal} from '$lib/platform/types';
declare global {namespace App {interface Locals {characterWorkshopAuthorized?:boolean;principal?:Principal|null}}}
export {};
