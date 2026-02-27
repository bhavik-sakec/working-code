package com.mrx.fileparserengine.util;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

/**
 * Utility class for date formatting
 */
public class DateUtil {

    private static final DateTimeFormatter FORMATTER = DateTimeFormatter.ofPattern("yyyyMMdd");

    /**
     * Get current date in CCYYMMDD format
     * 
     * @return Formatted date string
     */
    public static String getCurrentDate() {
        return LocalDate.now().format(FORMATTER);
    }

    /**
     * Format a LocalDate to CCYYMMDD format
     * 
     * @param date The date to format
     * @return Formatted date string
     */
    public static String formatDate(LocalDate date) {
        if (date == null) {
            return "";
        }
        return date.format(FORMATTER);
    }

    /**
     * Parse a date string in CCYYMMDD format
     * 
     * @param dateStr The date string
     * @return LocalDate object or null if parsing fails
     */
    public static LocalDate parseDate(String dateStr) {
        if (dateStr == null || dateStr.trim().isEmpty()) {
            return null;
        }
        try {
            return LocalDate.parse(dateStr.trim(), FORMATTER);
        } catch (Exception e) {
            return null;
        }
    }
}
