import { Component, ChangeDetectorRef, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

export abstract class BaseBoxComponent {
    protected cdr = inject(ChangeDetectorRef);
    protected sanitizer = inject(DomSanitizer);
    show = false;
    message: SafeHtml = '';
}
