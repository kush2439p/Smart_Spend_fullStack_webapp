package com.smartspend.controller;

import com.smartspend.dto.SmsParseRequest;
import com.smartspend.service.SmsService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/sms")
@RequiredArgsConstructor
public class SmsController {

    private final SmsService smsService;

    @PostMapping("/parse")
    public ResponseEntity<Map<String, Object>> parseSms(@Valid @RequestBody SmsParseRequest request) {
        return ResponseEntity.ok(smsService.parseSms(request));
    }
}
