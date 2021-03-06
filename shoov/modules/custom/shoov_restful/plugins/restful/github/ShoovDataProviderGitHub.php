<?php

/**
 * @file
 * Contains \RestfulDataProviderCToolsPlugins
 */

abstract class ShoovDataProviderGitHub extends \RestfulBase implements \ShoovDataProviderGitHubInterface {

  /**
   * The loaded repositories.
   *
   * @var array
   */
  protected $repos = array();

  /**
   * The loaded organizations.
   *
   * @var array
   */
  protected $orgs = array();

  /**
   * The navigation links.
   *
   * @var array
   */
  protected $links = array();

  /**
   * Return the plugins.
   *
   * @return array
   */
  public function getRepos() {
    if ($this->repos) {
      return $this->repos;
    }
    // Get range and page number either from url or default ones.
    $params = $this->parseRequestForListPagination();
    $range = intval($params[1]);
    $page = ($params[0] / $range) + 1;

    $wrapper = entity_metadata_wrapper('user', $this->getAccount());
    $user_name = $wrapper->label();
    $access_token = $wrapper->field_github_access_token->value();

    $options = array(
      'method' => 'GET',
      'headers' => array(
        'Authorization' => 'token ' . $access_token,
      ),
    );

    // Get organization name if exist.
    $request = $this->getRequest();
    $org = !empty($request['organization']) ? $request['organization'] : FALSE;
    $query = "?per_page=$range&page=$page";
    // Set url according to organization:
    // NULL - get all user's repositories;
    // 'me' - get user's own repositories;
    // 'value' - get organization's repositories, user is member of.
    if (!$org) {
      $url = "user/repos";
    }
    elseif ($org == 'me') {
      $url = "users/$user_name/repos";
    }
    else {
      $url = "orgs/$org/repos";
      $query .= "&type=member";
    }

    $response = shoov_github_http_request($url . $query, $options);
    $data = $response['data'];

    // Format navigation links.
    $this->links = $response['meta']['Link'];
    $this->formatNavigationLinks();

    $this->repos = $this->getKeyedById($data);

    // @todo: Make this configurable by the plugin.
    $this->syncLocalRepos();
    return $this->repos;
  }

  /**
   * Return the plugins.
   *
   * @return array
   */
  public function getOrgs() {
    if ($this->orgs) {
      return $this->orgs;
    }

    $wrapper = entity_metadata_wrapper('user', $this->getAccount());
    $access_token = $wrapper->field_github_access_token->value();

    $options = array(
      'headers' => array(
        'Authorization' => 'token ' . $access_token,
      ),
    );

    $orgs = shoov_github_http_request("user/orgs?per_page=$this->range", $options);

    // Add user to organization list as user can be the owner of the repository
    // like an organization.
    $gihub_account = shoov_github_http_request('user', $options);
    $data = array_merge($orgs['data'], array($gihub_account['data']));

    $this->orgs = $this->getKeyedById($data);

    return $this->orgs;
  }

  /**
   * Return the plugins list, keyed by ID.
   *
   * @param array $plugins
   *   The plugins list.
   *
   * @return array
   *   Array keyed by the plugin ID.
   */
  protected function getKeyedById(array $plugins) {
    $return = array();
    foreach ($plugins as $plugin) {
      $return[$plugin['id']] = $plugin;
    }

    return $return;
  }

  /**
   * @todo: Update the repository title by the GitHub repo ID.
   */
  protected function syncLocalRepos() {
    // Get all the local repos by the GitHub repo ID.
    $ids = array_keys($this->repos);

    if (!$ids) {
      // No repositories were provided.
      return;
    }

    $query = new EntityFieldQuery();
    $result = $query
      ->entityCondition('entity_type', 'node')
      ->entityCondition('bundle', 'repository')
      ->propertyCondition('status', NODE_PUBLISHED)
      ->fieldCondition('field_github_id', 'value', $ids, 'IN')
      ->addTag('DANGEROUS_ACCESS_CHECK_OPT_OUT')
      ->execute();

    if (empty($result['node'])) {
      // No matching local repos.
      return;
    }

    $repo_ids = array_keys($result['node']);
    $repo_nodes = array();

    foreach(node_load_multiple($repo_ids) as $repo) {
      // Key array by repo node ID.
      $repo_nodes[$repo->nid] = $repo;
    }

    $query = new EntityFieldQuery();
    $result = $query
      ->entityCondition('entity_type', 'node')
      ->entityCondition('bundle', 'ci_build')
      ->propertyCondition('status', NODE_PUBLISHED)
      ->fieldCondition('og_repo', 'target_id', $repo_ids, 'IN')
      ->addTag('DANGEROUS_ACCESS_CHECK_OPT_OUT')
      ->execute();

    if (!empty($result['node'])) {
      foreach (node_load_multiple(array_keys($result['node'])) as $build) {
        $build_wrapper = entity_metadata_wrapper('node', $build);
        $repo_id = $build_wrapper->og_repo->value(array('identifier' => TRUE));

        // Add the build info.
        // @todo: use the CI-build RESTful resource.
        $repo_nodes[$repo_id]->_ci_build = array(
          'id' => $build->nid,
          'branch' => $build_wrapper->field_git_branch->value(),
          'enabled' => $build_wrapper->field_ci_build_enabled->value(),
        );

      }

    }

    foreach ($repo_nodes as $node) {
      $wrapper = entity_metadata_wrapper('node', $node);
      $github_id = $wrapper->field_github_id->value();

      if (empty($this->repos[$github_id])) {
        // @todo: Delete the repo and content?
        // Repo does no longer exist.
        continue;
      }


      $repo = &$this->repos[$github_id];
      $repo['shoov_id'] = $node->nid;

      // Get the build info.
      $repo['shoov_build'] = !empty($node->_ci_build) ? $node->_ci_build : NULL;
    }
  }

  /**
   * Gets the plugins filtered and sorted by the request.
   *
   * @param array $plugins
   *  Array of plugins.
   *
   * @return array
   *   Array of plugins.
   */
  public function getSortedAndFiltered($plugins) {
    $public_fields = $this->getPublicFields();

    foreach ($this->parseRequestForListFilter() as $filter) {
      foreach ($plugins as $plugin_name => $plugin) {
        // Initialize to TRUE for AND and FALSE for OR (neutral value).
        $match = $filter['conjunction'] == 'AND';
        for ($index = 0; $index < count($filter['value']); $index++) {
          $property = $public_fields[$filter['public_field']]['property'];

          if (empty($plugin[$property])) {
            // Property doesn't exist on the plugin, so filter it out.
            unset($plugins[$plugin_name]);
          }

          if ($filter['conjunction'] == 'OR') {
            $match = $match || $this->evaluateExpression($plugin[$property], $filter['value'][$index], $filter['operator'][$index]);
            if ($match) {
              break;
            }
          }
          else {
            $match = $match && $this->evaluateExpression($plugin[$property], $filter['value'][$index], $filter['operator'][$index]);
            if (!$match) {
              break;
            }
          }
        }
        if (!$match) {
          // Property doesn't match the filter.
          unset($plugins[$plugin_name]);
        }
      }
    }


    if ($this->parseRequestForListSort()) {
      uasort($plugins, array($this, 'sortMultiCompare'));
    }

    return $plugins;
  }

  /**
   * Overrides \RestfulBase::isValidConjuctionForFilter().
   */
  protected static function isValidConjunctionForFilter($conjunction) {
    $allowed_conjunctions = array(
      'AND',
      'OR',
    );

    if (!in_array(strtoupper($conjunction), $allowed_conjunctions)) {
      throw new \RestfulBadRequestException(format_string('Conjunction "@conjunction" is not allowed for filtering on this resource. Allowed conjunctions are: !allowed', array(
        '@conjunction' => $conjunction,
        '!allowed' => implode(', ', $allowed_conjunctions),
      )));
    }
  }

  /**
   * Evaluate a simple expression.
   *
   * @param $value1
   *   The first value.
   * @param $value2
   *   The second value.
   * @param $operator
   *   The operator.
   *
   * @return bool
   *   TRUE or FALSE based on the evaluated expression.
   *
   * @throws RestfulBadRequestException
   */
  protected function evaluateExpression($value1, $value2, $operator) {
    switch($operator) {
      case '=':
        return $value1 == $value2;

      case '<':
        return $value1 < $value2;

      case '>':
        return $value1 > $value2;

      case '>=':
        return $value1 >= $value2;

      case '<=':
        return $value1 <= $value2;

      case '<>':
      case '!=':
        return $value1 != $value2;

      case 'IN':
        return in_array($value1, $value2);

      case 'BETWEEN':
        return $value1 >= $value2[0] && $value1 >= $value2[1];
    }
  }

  /**
   * Sort plugins by multiple criteria.
   *
   * @param $value1
   *   The first value.
   * @param $value2
   *   The second value.
   *
   * @return int
   *   The values expected by uasort() function.
   *
   * @link http://stackoverflow.com/a/13673568/750039
   */
  protected function sortMultiCompare($value1, $value2) {
    $sorts = $this->parseRequestForListSort();
    foreach ($sorts as $key => $order){
      if ($value1[$key] == $value2[$key]) {
        continue;
      }

      return ($order == 'DESC' ? -1 : 1) * strcmp($value1[$key], $value2[$key]);
    }

    return 0;
  }

  /**
   * {@inheritdoc}
   */
  public function getTotalCount() {
    $source = $this->plugin['resource'] == 'github_orgs' ? $this->getOrgs() : $this->getRepos();
    return count($this->getSortedAndFiltered($source));
  }

  /**
   * {@inheritdoc}
   */
  public function additionalHateoas() {
    return $this->links;
  }

  /**
   * {@inheritdoc}
   *
   * Links example:
   * @code
   * $links = array(
   *  array(
   *    'https://api.github.com/user/repos?per_page=50&page=2&callback=result',
   *    array(
   *      'rel' => 'next'
   *    ),
   *  ),
   *  array(
   *    'https://api.github.com/user/repos?per_page=50&page=2&callback=result',
   *    array(
   *      'rel' => 'last'
   *    ),
   *  ),
   * );
   * @endcode
   */
  public function formatNavigationLinks() {
    $links = $this->links;

    $formated_links = array();
    foreach ($links as $link) {
      $href = $link[0];
      $name = $link[1]['rel'];

      $href = parse_url($href);
      $href = $this->versionedUrl($this->getPath()) . '?' . str_replace(array('&callback=result', 'callback=result'), '', $href['query']);

      $formated_links[$name] = array('title' => $name, 'href' => $href);
    }
    $this->links = $formated_links;
    return $formated_links;
  }

  public function index() {
    $return = array();
    $method = $this->plugin['resource'] == 'github_orgs' ? 'getOrgs' : 'getRepos';

    foreach (array_keys($this->getSortedAndFiltered($this->$method())) as $plugin_name) {
      $return[] = $this->view($plugin_name);
    }
    return $return;
  }

  /**
   * {@inheritdoc}
   *
   * @todo: We should generalize this, as it's repeated often.
   */
  public function view($id) {
    $cache_id = array(
      'id' => $id,
    );
    $cached_data = $this->getRenderedCache($cache_id);
    if (!empty($cached_data->data)) {
      return $cached_data->data;
    }

    $item = $this->plugin['resource'] == 'github_orgs' ? $this->orgs[$id] : $this->repos[$id];

    // Loop over all the defined public fields.
    foreach ($this->getPublicFields() as $public_field_name => $info) {
      $value = NULL;

      if ($info['create_or_update_passthrough']) {
        // The public field is a dummy one, meant only for passing data upon
        // create or update.
        continue;
      }

      // If there is a callback defined execute it instead of a direct mapping.
      if ($info['callback']) {
        $value = static::executeCallback($info['callback'], array($item));
      }
      // Map row names to public properties.
      elseif ($info['property']) {
        $value = !empty($item[$info['property']]) ? $item[$info['property']] : NULL;
      }

      // Execute the process callbacks.
      if ($value && $info['process_callbacks']) {
        foreach ($info['process_callbacks'] as $process_callback) {
          $value = static::executeCallback($process_callback, array($value));
        }
      }

      $output[$public_field_name] = $value;
    }

    $this->setRenderedCache($output, $cache_id);
    return $output;
  }

  /**
   * Put in the field only owner name.
   *
   * @param $value
   *  The owner value.
   *
   * @return string
   *  Return owner name - organization or user name
   */
  protected function organizationProcess($value) {
    return $value['login'];
  }
}

