package com.campusconnect.config;

import com.campusconnect.project.ProjectService;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Lazy;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessageDeliveryException;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

/**
 * STOMP over WebSocket at /ws. The client sends its JWT in the CONNECT frame's Authorization header;
 * project topics (/topic/projects/{id}) only accept subscriptions from that project's members.
 */
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private static final Pattern PROJECT_TOPIC = Pattern.compile("^/topic/projects/(\\d+)(/.*)?$");

    private final JwtDecoder jwtDecoder;
    private final ProjectService projects;
    private final String[] frontendUrls;

    public WebSocketConfig(JwtDecoder jwtDecoder, @Lazy ProjectService projects,
                           @Value("${app.frontend-urls}") String frontendUrls) {
        this.jwtDecoder = jwtDecoder;
        this.projects = projects;
        this.frontendUrls = frontendUrls.split("\\s*,\\s*");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws").setAllowedOriginPatterns(frontendUrls);
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.enableSimpleBroker("/topic", "/queue");
        registry.setApplicationDestinationPrefixes("/app");
        registry.setUserDestinationPrefix("/user");
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(new ChannelInterceptor() {
            @Override
            public Message<?> preSend(Message<?> message, MessageChannel channel) {
                StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
                if (accessor == null || accessor.getCommand() == null) {
                    return message;
                }
                if (accessor.getCommand() == StompCommand.CONNECT) {
                    accessor.setUser(authenticate(accessor.getFirstNativeHeader("Authorization")));
                } else if (accessor.getCommand() == StompCommand.SUBSCRIBE) {
                    authorizeSubscription(accessor);
                }
                return message;
            }
        });
    }

    private JwtAuthenticationToken authenticate(String header) {
        if (header == null || !header.startsWith("Bearer ")) {
            throw new MessageDeliveryException("Missing bearer token");
        }
        try {
            Jwt jwt = jwtDecoder.decode(header.substring(7));
            return new JwtAuthenticationToken(jwt);
        } catch (JwtException e) {
            throw new MessageDeliveryException("Invalid token");
        }
    }

    private void authorizeSubscription(StompHeaderAccessor accessor) {
        if (!(accessor.getUser() instanceof JwtAuthenticationToken auth)) {
            throw new MessageDeliveryException("Not authenticated");
        }
        String destination = accessor.getDestination();
        if (destination == null) {
            return;
        }
        Matcher m = PROJECT_TOPIC.matcher(destination);
        if (m.matches()) {
            long userId = Long.parseLong(auth.getName());
            if (!projects.isMember(Long.parseLong(m.group(1)), userId)) {
                throw new MessageDeliveryException("Not a member of this project");
            }
        } else if (!destination.startsWith("/user/")) {
            throw new MessageDeliveryException("Unknown destination");
        }
    }
}
