/** Own process signal listeners only while an external decoder is running. */
export function decoderSignals(signal?: AbortSignal): {
	signal: AbortSignal;
	dispose(): void;
} {
	const controller = new AbortController();
	const cancel = () =>
		controller.abort(new Error("Transcript decoding cancelled"));
	process.once("SIGINT", cancel);
	process.once("SIGTERM", cancel);
	return {
		signal: signal
			? AbortSignal.any([signal, controller.signal])
			: controller.signal,
		dispose() {
			process.off("SIGINT", cancel);
			process.off("SIGTERM", cancel);
		},
	};
}
