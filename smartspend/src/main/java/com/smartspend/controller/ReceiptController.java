package com.smartspend.controller;

import com.smartspend.service.ReceiptService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

@RestController
@RequestMapping("/api/receipts")
@RequiredArgsConstructor
public class ReceiptController {

    private final ReceiptService receiptService;

    @PostMapping("/scan")
    public ResponseEntity<Map<String, Object>> scanReceipt(@RequestParam("file") MultipartFile file) {
        return ResponseEntity.ok(receiptService.scanReceipt(file));
    }
}
