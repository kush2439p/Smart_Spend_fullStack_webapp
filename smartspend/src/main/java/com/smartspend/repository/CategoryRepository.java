package com.smartspend.repository;

import com.smartspend.model.Category;
import com.smartspend.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CategoryRepository extends JpaRepository<Category, Long> {

    List<Category> findByUser(User user);

    List<Category> findByUserAndType(User user, Category.CategoryType type);

    Optional<Category> findByIdAndUser(Long id, User user);

    Optional<Category> findByUserAndName(User user, String name);

    boolean existsByIdAndUser(Long id, User user);
}
