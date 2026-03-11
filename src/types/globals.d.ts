// d3 is injected globally by webpack ProvidePlugin + <script> tag
declare var d3: typeof import("d3");

// Injected at build time by webpack DefinePlugin
declare var __WEBVOWL_VERSION__: string;
