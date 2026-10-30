package com.campusconnect.common;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * Runs slow side effects (AI calls, webhooks) off the request thread, and only once the
 * surrounding transaction has committed so they never see or announce rolled-back data.
 */
public final class AfterCommit {

    private static final ExecutorService EXECUTOR = Executors.newVirtualThreadPerTaskExecutor();

    private AfterCommit() {
    }

    public static void runAsync(Runnable task) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    EXECUTOR.execute(task);
                }
            });
        } else {
            EXECUTOR.execute(task);
        }
    }
}
