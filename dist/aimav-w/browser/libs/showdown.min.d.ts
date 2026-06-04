// TypeScript declaration file for the showdown.js library.
// This provides minimal typings to allow TypeScript projects to use the
// library without compilation errors. It mirrors the public API of
// showdown (https://github.com/showdownjs/showdown).

declare module "showdown" {
    /**
     * Options that can be passed to the Converter constructor or set via
     * `setOption`.
     */
    interface ConverterOptions {
        [option: string]: any;
    }

    /**
     * The main Converter class used to transform Markdown to HTML.
     */
    class Converter {
        /**
         * Create a new Converter instance.
         * @param options Optional configuration object.
         */
        constructor(options?: ConverterOptions);

        /**
         * Convert a Markdown string to HTML.
         */
        makeHtml(markdown: string): string;

        /**
         * Set a single option after the Converter has been created.
         */
        setOption(option: string, value: any): void;

        /**
         * Retrieve the current value of an option.
         */
        getOption(option: string): any;

        /**
         * Reset all options to their default values.
         */
        resetOptions(): void;

        /**
         * Set the flavor (e.g., "github", "original").
         */
        setFlavor(flavor: string): void;

        /**
         * Get the currently set flavor.
         */
        getFlavor(): string;
    }

    /**
     * Helper function to create a new Converter instance without using `new`.
     */
    function converter(options?: ConverterOptions): Converter;

    /**
     * Export the Converter class as the default export for ES module usage.
     */
    export default Converter;
    export { Converter, ConverterOptions, converter };
}
