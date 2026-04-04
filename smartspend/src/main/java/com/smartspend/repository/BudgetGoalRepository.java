package com.smartspend.repository;

import com.smartspend.model.BudgetGoal;
import com.smartspend.model.Category;
import com.smartspend.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface BudgetGoalRepository extends JpaRepository<BudgetGoal, Long> {

    List<BudgetGoal> findByUser(User user);

    Optional<BudgetGoal> findByIdAndUser(Long id, User user);

    List<BudgetGoal> findByUserAndMonthAndYear(User user, int month, int year);

    Optional<BudgetGoal> findByUserAndCategoryAndMonthAndYear(User user, Category category, int month, int year);
}
