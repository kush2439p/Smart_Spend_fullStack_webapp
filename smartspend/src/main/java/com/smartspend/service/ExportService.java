package com.smartspend.service;

import com.itextpdf.text.*;
import com.itextpdf.text.pdf.*;
import com.smartspend.model.Transaction;
import com.smartspend.model.User;
import com.smartspend.repository.TransactionRepository;
import com.smartspend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class ExportService {

    private final TransactionRepository transactionRepository;
    private final UserRepository userRepository;

    private User getCurrentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));
    }

    public byte[] exportCsv() {
        User user = getCurrentUser();
        List<Transaction> transactions = transactionRepository.findByUserOrderByDateDescCreatedAtDesc(user);

        StringBuilder csv = new StringBuilder();
        csv.append("Date,Time,Title,Category,Type,Amount,Source,Note\n");

        for (Transaction t : transactions) {
            csv.append(escapeCsv(t.getDate().toString())).append(",");
            csv.append(escapeCsv(t.getTime() != null ? t.getTime().toString() : "")).append(",");
            csv.append(escapeCsv(t.getTitle())).append(",");
            csv.append(escapeCsv(t.getCategory().getName())).append(",");
            csv.append(escapeCsv(t.getType().name())).append(",");
            csv.append(escapeCsv(t.getAmount().toPlainString())).append(",");
            csv.append(escapeCsv(t.getSource().name())).append(",");
            csv.append(escapeCsv(t.getNote() != null ? t.getNote() : "")).append("\n");
        }

        return csv.toString().getBytes();
    }

    private String escapeCsv(String value) {
        if (value == null) return "";
        if (value.contains(",") || value.contains("\"") || value.contains("\n")) {
            return "\"" + value.replace("\"", "\"\"") + "\"";
        }
        return value;
    }

    public byte[] exportPdf() {
        User user = getCurrentUser();
        List<Transaction> transactions = transactionRepository.findByUserOrderByDateDescCreatedAtDesc(user);

        try {
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            Document document = new Document(PageSize.A4, 36, 36, 54, 36);
            PdfWriter.getInstance(document, baos);
            document.open();

            Font titleFont = new Font(Font.FontFamily.HELVETICA, 20, Font.BOLD, new BaseColor(124, 58, 237));
            Font headerFont = new Font(Font.FontFamily.HELVETICA, 9, Font.BOLD, BaseColor.WHITE);
            Font normalFont = new Font(Font.FontFamily.HELVETICA, 8, Font.NORMAL, BaseColor.DARK_GRAY);
            Font boldFont = new Font(Font.FontFamily.HELVETICA, 10, Font.BOLD, BaseColor.BLACK);
            Font subFont = new Font(Font.FontFamily.HELVETICA, 9, Font.NORMAL, new BaseColor(107, 114, 128));

            // Header
            Paragraph title = new Paragraph("SmartSpend Export Report", titleFont);
            title.setAlignment(Element.ALIGN_CENTER);
            title.setSpacingAfter(4);
            document.add(title);

            Paragraph meta = new Paragraph(
                    "User: " + user.getName() + " (" + user.getEmail() + ")   |   " +
                    "Exported: " + LocalDate.now().format(DateTimeFormatter.ofPattern("dd MMM yyyy")),
                    subFont);
            meta.setAlignment(Element.ALIGN_CENTER);
            meta.setSpacingAfter(16);
            document.add(meta);

            // Summary
            BigDecimal totalIncome = transactions.stream()
                    .filter(t -> t.getType() == Transaction.TransactionType.INCOME)
                    .map(Transaction::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
            BigDecimal totalExpense = transactions.stream()
                    .filter(t -> t.getType() == Transaction.TransactionType.EXPENSE)
                    .map(Transaction::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
            BigDecimal netBalance = totalIncome.subtract(totalExpense);

            PdfPTable summaryTable = new PdfPTable(3);
            summaryTable.setWidthPercentage(100);
            summaryTable.setSpacingAfter(16);

            addSummaryCell(summaryTable, "Total Income", "Rs " + totalIncome.toPlainString(), new BaseColor(34, 197, 94));
            addSummaryCell(summaryTable, "Total Expense", "Rs " + totalExpense.toPlainString(), new BaseColor(239, 68, 68));
            addSummaryCell(summaryTable, "Net Balance", "Rs " + netBalance.toPlainString(),
                    netBalance.compareTo(BigDecimal.ZERO) >= 0 ? new BaseColor(59, 130, 246) : new BaseColor(239, 68, 68));
            document.add(summaryTable);

            // Table heading
            Paragraph tableTitle = new Paragraph("All Transactions (" + transactions.size() + ")", boldFont);
            tableTitle.setSpacingBefore(8);
            tableTitle.setSpacingAfter(6);
            document.add(tableTitle);

            // Transactions table
            PdfPTable table = new PdfPTable(new float[]{12, 8, 24, 14, 10, 12, 10, 10});
            table.setWidthPercentage(100);
            table.setHeaderRows(1);

            String[] headers = {"Date", "Time", "Title", "Category", "Type", "Amount", "Source", "Note"};
            for (String h : headers) {
                PdfPCell cell = new PdfPCell(new Phrase(h, headerFont));
                cell.setBackgroundColor(new BaseColor(124, 58, 237));
                cell.setPadding(5);
                cell.setHorizontalAlignment(Element.ALIGN_CENTER);
                cell.setVerticalAlignment(Element.ALIGN_MIDDLE);
                table.addCell(cell);
            }

            DateTimeFormatter dateFormatter = DateTimeFormatter.ofPattern("dd/MM/yy");
            boolean alternate = false;
            for (Transaction t : transactions) {
                BaseColor rowColor = alternate ? new BaseColor(249, 250, 251) : BaseColor.WHITE;
                alternate = !alternate;

                addTableCell(table, t.getDate().format(dateFormatter), normalFont, rowColor, Element.ALIGN_CENTER);
                addTableCell(table, t.getTime() != null ? t.getTime().toString().substring(0, 5) : "", normalFont, rowColor, Element.ALIGN_CENTER);
                addTableCell(table, t.getTitle(), normalFont, rowColor, Element.ALIGN_LEFT);
                addTableCell(table, t.getCategory().getName(), normalFont, rowColor, Element.ALIGN_LEFT);

                Font typeFont = new Font(Font.FontFamily.HELVETICA, 8, Font.BOLD,
                        t.getType() == Transaction.TransactionType.INCOME ? new BaseColor(34, 197, 94) : new BaseColor(239, 68, 68));
                addTableCell(table, t.getType().name(), typeFont, rowColor, Element.ALIGN_CENTER);

                Font amtFont = new Font(Font.FontFamily.HELVETICA, 8, Font.BOLD,
                        t.getType() == Transaction.TransactionType.INCOME ? new BaseColor(34, 197, 94) : new BaseColor(239, 68, 68));
                addTableCell(table, "Rs " + t.getAmount().toPlainString(), amtFont, rowColor, Element.ALIGN_RIGHT);

                addTableCell(table, t.getSource().name(), normalFont, rowColor, Element.ALIGN_CENTER);
                addTableCell(table, t.getNote() != null ? t.getNote() : "", normalFont, rowColor, Element.ALIGN_LEFT);
            }

            document.add(table);

            Paragraph footer = new Paragraph(
                    "\nTotal Transactions: " + transactions.size() + "   |   Generated by SmartSpend on " + LocalDate.now(),
                    subFont);
            footer.setAlignment(Element.ALIGN_CENTER);
            footer.setSpacingBefore(12);
            document.add(footer);

            document.close();
            return baos.toByteArray();

        } catch (Exception e) {
            log.error("PDF generation failed: {}", e.getMessage());
            throw new RuntimeException("Failed to generate PDF: " + e.getMessage());
        }
    }

    private void addSummaryCell(PdfPTable table, String label, String value, BaseColor color) {
        PdfPCell cell = new PdfPCell();
        cell.setBackgroundColor(color);
        cell.setPadding(10);
        cell.setBorder(Rectangle.NO_BORDER);
        cell.setHorizontalAlignment(Element.ALIGN_CENTER);

        Font labelFont = new Font(Font.FontFamily.HELVETICA, 9, Font.NORMAL, BaseColor.WHITE);
        Font valueFont = new Font(Font.FontFamily.HELVETICA, 13, Font.BOLD, BaseColor.WHITE);

        Paragraph labelP = new Paragraph(label, labelFont);
        labelP.setAlignment(Element.ALIGN_CENTER);
        Paragraph valueP = new Paragraph(value, valueFont);
        valueP.setAlignment(Element.ALIGN_CENTER);

        cell.addElement(labelP);
        cell.addElement(valueP);
        table.addCell(cell);
    }

    private void addTableCell(PdfPTable table, String text, Font font, BaseColor background, int alignment) {
        PdfPCell cell = new PdfPCell(new Phrase(text != null ? text : "", font));
        cell.setBackgroundColor(background);
        cell.setPadding(4);
        cell.setHorizontalAlignment(alignment);
        cell.setVerticalAlignment(Element.ALIGN_MIDDLE);
        cell.setBorderColor(new BaseColor(229, 231, 235));
        table.addCell(cell);
    }
}
