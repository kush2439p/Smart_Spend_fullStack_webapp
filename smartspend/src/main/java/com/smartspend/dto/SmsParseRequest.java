package com.smartspend.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class SmsParseRequest {

    @NotBlank(message = "SMS text is required")
    private String text;

    private String timestamp;
}
