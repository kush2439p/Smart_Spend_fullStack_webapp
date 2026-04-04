package com.smartspend.repository;

import com.smartspend.model.Category;
import com.smartspend.model.Transaction;
import com.smartspend.model.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface TransactionRepository extends JpaRepository<Transaction, Long> {

    Page<Transaction> findByUser(User user, Pageable pageable);

    List<Transaction> findByUserOrderByDateDescCreatedAtDesc(User user);

    Optional<Transaction> findByIdAndUser(Long id, User user);

    List<Transaction> findTop5ByUserOrderByDateDescCreatedAtDesc(User user);

    @Query("SELECT t FROM Transaction t WHERE t.user = :user ORDER BY t.date DESC, t.createdAt DESC")
    List<Transaction> findTopByUser(@Param("user") User user, Pageable pageable);

    @Query("SELECT t FROM Transaction t WHERE t.user = :user AND t.type = :type ORDER BY t.date DESC")
    Page<Transaction> findByUserAndType(@Param("user") User user,
                                        @Param("type") Transaction.TransactionType type,
                                        Pageable pageable);

    @Query("SELECT t FROM Transaction t WHERE t.user = :user AND t.category = :category ORDER BY t.date DESC")
    Page<Transaction> findByUserAndCategory(@Param("user") User user,
                                             @Param("category") Category category,
                                             Pageable pageable);

    @Query("SELECT t FROM Transaction t WHERE t.user = :user AND t.date BETWEEN :start AND :end ORDER BY t.date DESC")
    Page<Transaction> findByUserAndDateBetween(@Param("user") User user,
                                                @Param("start") LocalDate start,
                                                @Param("end") LocalDate end,
                                                Pageable pageable);

    @Query("SELECT t FROM Transaction t WHERE t.user = :user AND t.type = :type AND t.category = :category AND t.date BETWEEN :start AND :end ORDER BY t.date DESC")
    Page<Transaction> findByUserAndTypeAndCategoryAndDateBetween(@Param("user") User user,
                                                                  @Param("type") Transaction.TransactionType type,
                                                                  @Param("category") Category category,
                                                                  @Param("start") LocalDate start,
                                                                  @Param("end") LocalDate end,
                                                                  Pageable pageable);

    // Used by the frontend when filtering by type + category (without date range).
    Page<Transaction> findByUserAndTypeAndCategory(User user,
                                                    Transaction.TransactionType type,
                                                    Category category,
                                                    Pageable pageable);

    // Used by the frontend when filtering by type + date range.
    Page<Transaction> findByUserAndTypeAndDateBetween(User user,
                                                        Transaction.TransactionType type,
                                                        LocalDate start,
                                                        LocalDate end,
                                                        Pageable pageable);

    // Used by the frontend when filtering by category + date range.
    Page<Transaction> findByUserAndCategoryAndDateBetween(User user,
                                                         Category category,
                                                         LocalDate start,
                                                         LocalDate end,
                                                         Pageable pageable);

    @Query("SELECT COALESCE(SUM(t.amount), 0) FROM Transaction t WHERE t.user = :user AND t.type = :type")
    BigDecimal sumAmountByUserAndType(@Param("user") User user, @Param("type") Transaction.TransactionType type);

    @Query("SELECT COALESCE(SUM(t.amount), 0) FROM Transaction t WHERE t.user = :user AND t.type = :type AND MONTH(t.date) = :month AND YEAR(t.date) = :year")
    BigDecimal sumAmountByUserAndTypeAndMonthAndYear(@Param("user") User user,
                                                      @Param("type") Transaction.TransactionType type,
                                                      @Param("month") int month,
                                                      @Param("year") int year);

    @Query("SELECT COALESCE(SUM(t.amount), 0) FROM Transaction t WHERE t.user = :user AND t.type = 'EXPENSE' AND t.category = :category AND MONTH(t.date) = :month AND YEAR(t.date) = :year")
    BigDecimal sumExpenseByUserAndCategoryAndMonthAndYear(@Param("user") User user,
                                                           @Param("category") Category category,
                                                           @Param("month") int month,
                                                           @Param("year") int year);

    @Query("SELECT t FROM Transaction t WHERE t.user = :user AND MONTH(t.date) = :month AND YEAR(t.date) = :year ORDER BY t.date DESC")
    List<Transaction> findByUserAndMonthAndYear(@Param("user") User user,
                                                 @Param("month") int month,
                                                 @Param("year") int year);

    @Query("SELECT t FROM Transaction t WHERE t.user = :user AND t.date BETWEEN :start AND :end ORDER BY t.date DESC")
    List<Transaction> findByUserAndDateBetweenList(@Param("user") User user,
                                                    @Param("start") LocalDate start,
                                                    @Param("end") LocalDate end);

    @Query("SELECT t.category, COALESCE(SUM(t.amount), 0) as total FROM Transaction t WHERE t.user = :user AND t.type = 'EXPENSE' AND MONTH(t.date) = :month AND YEAR(t.date) = :year GROUP BY t.category ORDER BY total DESC")
    List<Object[]> findTopCategoriesBySpending(@Param("user") User user,
                                                @Param("month") int month,
                                                @Param("year") int year);

    @Query("SELECT t.date, COALESCE(SUM(CASE WHEN t.type = 'EXPENSE' THEN t.amount ELSE 0 END), 0), COALESCE(SUM(CASE WHEN t.type = 'INCOME' THEN t.amount ELSE 0 END), 0) FROM Transaction t WHERE t.user = :user AND MONTH(t.date) = :month AND YEAR(t.date) = :year GROUP BY t.date ORDER BY t.date")
    List<Object[]> findDailyTotals(@Param("user") User user,
                                    @Param("month") int month,
                                    @Param("year") int year);

    @Query("SELECT MONTH(t.date), COALESCE(SUM(CASE WHEN t.type = 'INCOME' THEN t.amount ELSE 0 END), 0), COALESCE(SUM(CASE WHEN t.type = 'EXPENSE' THEN t.amount ELSE 0 END), 0) FROM Transaction t WHERE t.user = :user AND YEAR(t.date) = :year GROUP BY MONTH(t.date) ORDER BY MONTH(t.date)")
    List<Object[]> findMonthlyTotals(@Param("user") User user, @Param("year") int year);

    @Query("SELECT COUNT(t) FROM Transaction t WHERE t.user = :user AND t.category = :category AND t.type = :type AND MONTH(t.date) = :month AND YEAR(t.date) = :year")
    Long countByUserAndCategoryAndTypeAndMonthAndYear(
            @Param("user") User user,
            @Param("category") Category category,
            @Param("type") Transaction.TransactionType type,
            @Param("month") int month,
            @Param("year") int year);

    @Query("SELECT COALESCE(SUM(t.amount), 0) FROM Transaction t WHERE t.user = :user AND t.type = :type AND t.date >= :startDate")
    BigDecimal findMonthlyIncomeByUser(@Param("user") User user, @Param("type") Transaction.TransactionType type, @Param("startDate") LocalDate startDate);

    @Query("SELECT COALESCE(SUM(t.amount), 0) FROM Transaction t WHERE t.user = :user AND t.type = :type AND t.date >= :startDate")
    BigDecimal findMonthlyExpenseByUser(@Param("user") User user, @Param("type") Transaction.TransactionType type, @Param("startDate") LocalDate startDate);

    @Query("SELECT COALESCE(SUM(t.amount), 0) FROM Transaction t WHERE t.user = :user AND t.category = :category AND t.type = :type AND MONTH(t.date) = :month AND YEAR(t.date) = :year")
    BigDecimal sumAmountByUserAndCategoryAndTypeAndMonthAndYear(
            @Param("user") User user,
            @Param("category") Category category,
            @Param("type") Transaction.TransactionType type,
            @Param("month") int month,
            @Param("year") int year);
}
