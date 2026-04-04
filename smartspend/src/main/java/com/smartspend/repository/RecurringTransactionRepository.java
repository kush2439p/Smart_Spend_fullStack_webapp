package com.smartspend.repository;

import com.smartspend.model.RecurringTransaction;
import com.smartspend.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface RecurringTransactionRepository extends JpaRepository<RecurringTransaction, Long> {

    List<RecurringTransaction> findByUser(User user);

    Optional<RecurringTransaction> findByIdAndUser(Long id, User user);

    List<RecurringTransaction> findByIsActiveAndNextDueDate(boolean isActive, LocalDate nextDueDate);
}
