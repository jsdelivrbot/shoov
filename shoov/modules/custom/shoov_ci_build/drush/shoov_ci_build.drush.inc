<?php

/**
 * @file
 * Create a CI build item.
 */


/**
 * Implements hook_drush_command().
 */
function shoov_ci_build_drush_command() {
  $items = array();

  $items['create-ci-build-item'] = array(
    'description' => 'Create a CI build item.',
  );

  return $items;
}

/**
 * Implements drush_hook_command().
 *
 * Command callback for csv2sql.
 */
function drush_shoov_ci_build_create_ci_build_item() {
  if (!$messages = shoov_ci_build_get_ci_builds()) {
    drush_log('No items found for processing');
    return;
  }

  $count = count($messages);
  drush_log(dt('Found @count items for processing', array('@count' => $count)));

  $server_url = variable_get('shoov_build_pr_server', 'http://localhost:3000');
  if (!$server_url) {
    throw new Exception('Shoov build server is not setup.');
  }


  // Send requests.
  $delta = 1;
  foreach ($messages as $message) {
    $account = user_load($message->uid);

    $url = array(
      $server_url,
      'ci',
      $message->mid,
      shoov_restful_get_user_token($account),
    );

    $url = implode('/', $url);

    drupal_http_request($url);

    $params = array(
      '@delta' => $delta,
      '@count' => $count,
      '@id' => $message->mid,
    );

    drush_log(dt('@delta / @count) Process message ID @id', $params));
    $delta++;
  }
}