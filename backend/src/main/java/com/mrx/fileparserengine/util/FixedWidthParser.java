package com.mrx.fileparserengine.util;

/**
 * Utility class for parsing fixed-width file fields
 */
public class FixedWidthParser {

    /**
     * Extract a substring from a line based on start and end positions (1-indexed)
     * 
     * @param line  The input line
     * @param start Start position (1-indexed, inclusive)
     * @param end   End position (1-indexed, inclusive)
     * @return Trimmed substring or empty string if positions are invalid
     */
    public static String extract(String line, int start, int end) {
        if (line == null || line.isEmpty()) {
            return "";
        }

        // Convert to 0-indexed
        int startIdx = start - 1;
        int endIdx = end;

        // Validate indices
        if (startIdx < 0 || startIdx >= line.length()) {
            return "";
        }

        // Adjust end index if it exceeds line length
        if (endIdx > line.length()) {
            endIdx = line.length();
        }

        return line.substring(startIdx, endIdx).trim();
    }

    /**
     * Pad a string to the right with spaces to reach the specified length
     * 
     * @param value  The input value
     * @param length The target length
     * @return Padded string
     */
    public static String padRight(String value, int length) {
        if (value == null) {
            value = "";
        }

        if (value.length() >= length) {
            return value.substring(0, length);
        }

        return String.format("%-" + length + "s", value);
    }

    /**
     * Pad a string to the left with spaces to reach the specified length
     * 
     * @param value  The input value
     * @param length The target length
     * @return Padded string
     */
    public static String padLeft(String value, int length) {
        if (value == null) {
            value = "";
        }

        if (value.length() >= length) {
            return value.substring(0, length);
        }

        return String.format("%" + length + "s", value);
    }

    /**
     * Pad a numeric value to the left with zeros
     * 
     * @param value  The numeric value
     * @param length The target length
     * @return Zero-padded string
     */
    public static String padLeftZero(long value, int length) {
        return String.format("%0" + length + "d", value);
    }
}
