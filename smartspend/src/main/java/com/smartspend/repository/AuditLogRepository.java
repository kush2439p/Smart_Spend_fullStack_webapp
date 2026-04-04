package com.smartspend.repository;

import com.smartspend.model.AuditLog;
import com.smartspend.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {

    List<AuditLog> findByUserOrderByCreatedAtDesc(User user);

    List<AuditLog> findByUserAndEntityTypeOrderByCreatedAtDesc(User user, String entityType);
}
