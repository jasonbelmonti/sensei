import { normalizeWorkflowSearchPromptText } from "./workflow-search-text";

const PATH_PLACEHOLDER = "senseipathplaceholder";
const TICKET_PLACEHOLDER = "senseiticketplaceholder";
const NUMBER_PLACEHOLDER = "senseinumberplaceholder";

const SLASH_CONTAINING_TOKEN_PATTERN =
	/(?:(?<=^)|(?<=[\s("'`]))[^\s"'`<>|]*[\\/][^\s"'`<>|]*/gu;
const PUNCTUATED_TICKET_IDENTIFIER_PATTERN =
	/\b([a-z]{2,10})\s*[-_#]\s*\d{2,8}\b/giu;
const SPACE_SEPARATED_TICKET_IDENTIFIER_PATTERN =
	/\b([a-z]{2,10})\s+(\d{2,8})\b/giu;
const NUMERIC_LITERAL_PATTERN = /\b\d+\b/gu;
const ROOTED_FILESYSTEM_PATH_PREFIX_PATTERN =
	/^\/(?:Users|workspace|home|tmp|var|etc|opt|private|Volumes|Applications|Library)(?:\/|$)/;
const WINDOWS_FILESYSTEM_PATH_PREFIX_PATTERN = /^(?:[a-z]:[\\/]|\\\\)/i;
const DOT_RELATIVE_PATH_PREFIX_PATTERN = /^(?:~\/|\.\.?[\\/])/;
const FILE_EXTENSION_PATTERN = /\.[a-z0-9]{1,8}$/i;
const UNROOTED_FILESYSTEM_PATH_PREFIX_PATTERN =
	/^(?:src|test|tests|app|apps|lib|bin|docs|scripts|packages|public|assets|components|config|configs|\.codex|\.github|\.worktrees)$/i;
const ALLOWED_SPACE_SEPARATED_TICKET_PREFIX_PATTERN = /^(?:bel)$/i;
const DISALLOWED_SPACE_SEPARATED_TICKET_PREFIX_PATTERN =
	/^(?:api|cli|csv|css|html|http|https|iso|json|rfc|sdk|sql|xml|yaml|yml)$/i;

export function buildNearCanonicalPromptText(
	promptText: string,
): string | undefined {
	// Replace paths before punctuation folding so slash-delimited strings collapse
	// to one stable placeholder instead of leaking directory segments.
	const promptTextWithoutPaths = replacePathLikeStrings(promptText);
	const promptTextWithoutPathsOrTicketIdentifiers = replaceTicketIdentifiers(
		promptTextWithoutPaths,
	);
	const normalizedPromptText = normalizeWorkflowSearchPromptText(
		promptTextWithoutPathsOrTicketIdentifiers,
	);
	const nearCanonicalPromptText = replaceNumericLiterals(normalizedPromptText);

	return nearCanonicalPromptText.length > 0
		? nearCanonicalPromptText
		: undefined;
}

function replacePathLikeStrings(promptText: string): string {
	return promptText.replace(SLASH_CONTAINING_TOKEN_PATTERN, (match) =>
		isFilesystemPathLikeString(match) ? PATH_PLACEHOLDER : match,
	);
}

function replaceTicketIdentifiers(promptText: string): string {
	return promptText
		.replace(PUNCTUATED_TICKET_IDENTIFIER_PATTERN, (match, ticketPrefix) =>
			isTicketPrefix(ticketPrefix)
				? `${ticketPrefix} ${TICKET_PLACEHOLDER}`
				: match,
		)
		.replace(
			SPACE_SEPARATED_TICKET_IDENTIFIER_PATTERN,
			(match, ticketPrefix) =>
				isTicketPrefix(ticketPrefix)
					? `${ticketPrefix} ${TICKET_PLACEHOLDER}`
					: match,
		);
}

function replaceNumericLiterals(promptText: string): string {
	return promptText.replace(NUMERIC_LITERAL_PATTERN, (match) =>
		match.length >= 2 ? NUMBER_PLACEHOLDER : match,
	);
}

function isFilesystemPathLikeString(value: string): boolean {
	if (value.includes("://")) {
		return false;
	}

	if (
		DOT_RELATIVE_PATH_PREFIX_PATTERN.test(value) ||
		WINDOWS_FILESYSTEM_PATH_PREFIX_PATTERN.test(value) ||
		ROOTED_FILESYSTEM_PATH_PREFIX_PATTERN.test(value)
	) {
		return true;
	}

	if (value.startsWith("/.")) {
		return false;
	}

	if (value.startsWith("/")) {
		return false;
	}

	const segments = value.replaceAll("\\", "/").split("/").filter(Boolean);

	if (segments.length < 2) {
		return false;
	}

	if (segments.some((segment) => segment === "." || segment === "..")) {
		return true;
	}

	if (value.startsWith("/") === false && segments.some(isHiddenPathSegment)) {
		return true;
	}

	if (isUnrootedFilesystemPathPrefix(segments[0]) === false) {
		return false;
	}

	return FILE_EXTENSION_PATTERN.test(segments.at(-1) ?? "");
}

function isTicketPrefix(prefix: string): boolean {
	if (DISALLOWED_SPACE_SEPARATED_TICKET_PREFIX_PATTERN.test(prefix)) {
		return false;
	}

	return ALLOWED_SPACE_SEPARATED_TICKET_PREFIX_PATTERN.test(prefix);
}

function isHiddenPathSegment(segment: string): boolean {
	return segment.startsWith(".") && segment !== "." && segment !== "..";
}

function isUnrootedFilesystemPathPrefix(segment: string | undefined): boolean {
	return (
		segment !== undefined &&
		UNROOTED_FILESYSTEM_PATH_PREFIX_PATTERN.test(segment)
	);
}
