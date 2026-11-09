Describe 'YAM(B) — Balanced'
  run_balanced() {
    input="$SHELLSPEC_TMPBASE/balanced-input"
    cat > "$input"
    if [ "${YAMX_IMPL:-shell}" = js ]; then
      node src/cli.mjs --profile B "$1" "$input"
    elif [ "${YAMX_IMPL:-shell}" = lua ]; then
      "${YAMX_LUA:-lua5.1}" src/cli.lua --profile B "$1" "$input"
    else
      "${YAMX_SHELL:-sh}" src/yamx.sh --profile B "$1" "$input"
    fi
  }

  Describe 'block collections and typed values'
    It 'decodes nesting, sequences, quoted strings, plain strings and scalar types'
      Data
        #|# ignored
        #|name: 'Marek''s tools' # comment
        #|active: true
        #|missing: null
        #|items:
        #|  - shell
        #|  -
        #|    count: -12
        #|    empty: []
        #|url: https://example.org/#fragment # comment
      End
      When call run_balanced parse
      The status should be success
      The output should eq "$(printf "0\tmap\t\t\n1\tstr\tname\tMarek's tools\n1\tbool\tactive\ttrue\n1\tnull\tmissing\t\n1\tseq\titems\t\n2\tstr\t\tshell\n2\tmap\t\t\n3\tint\tcount\t-12\n3\tseq\tempty\t\n1\tstr\turl\thttps://example.org/#fragment")"
      The stderr should be blank
    End

    It 'keeps all Minimal meanings, including spaces and YAML-looking strings'
      Data
        #|yes: 'true'
        #|version: '01.20'
        #|space: '  x  '
        #|empty: ''
      End
      When call run_balanced parse
      The status should be success
      The output should eq "$(printf '0\tmap\t\t\n1\tstr\tyes\ttrue\n1\tstr\tversion\t01.20\n1\tstr\tspace\t  x  \n1\tstr\tempty\t')"
      The stderr should be blank
    End

    It 'accepts root sequences, empty collections, comments and blank lines'
      Data
        #|
        #|- {} # empty map
        #|- []
        #|
        #|- false
        #|- -0
        #|- yes
      End
      When call run_balanced parse
      The status should be success
      The output should eq "$(printf '0\tseq\t\t\n1\tmap\t\t\n1\tseq\t\t\n1\tbool\t\tfalse\n1\tint\t\t0\n1\tstr\t\tyes')"
      The stderr should be blank
    End

    It 'allows the same key in different maps'
      Data
        #|left:
        #|  name: one
        #|right:
        #|  name: two
      End
      When call run_balanced validate
      The status should be success
      The output should be blank
      The stderr should be blank
    End

    It 'reports physical source lines for duplicate keys and publishes no partial data'
      Data
        #|name: one
        #|# ignored
        #|
        #|name: two
      End
      When call run_balanced parse
      The status should eq 1
      The output should be blank
      The stderr should start with 'E_DUPLICATE line 4:'
    End
  End

  Describe 'nearby excluded spellings'
    Parameters
      'name: "double"'
      'name: 1.5'
      'name: 01'
      'name: 1e3'
      'name: +1'
      'name: .inf'
      'name: True'
      'name: NULL'
      'name: 9007199254740992'
      'name: -9007199254740992'
      'name: &anchor value'
      'name: *anchor'
      'name: !!str value'
      'name: |'
      'name: [a, b]'
      'name: {a: b}'
      "name: 'unclosed"
      "name: 'x'#comment"
      '{}#comment'
      'name: a: value'
      '- name: value'
      '---'
      '...'
      '%YAML 1.2'
      'true: value'
      'name:'
      '# comment only'
      ''
    End
    It "rejects <$1>"
      Data "$1"
      When call run_balanced parse
      The status should eq 1
      The output should be blank
      The stderr should not be blank
    End
  End

  Describe 'node transport generation'
    It 'emits quoted strings, escaping apostrophes, and block containers'
      Data printf "0\tmap\t\t\n1\tstr\tname\tMarek's\n1\tseq\titems\t\n2\tint\t\t3\n2\tnull\t\t\n1\tmap\tempty\t\n"
      When call run_balanced generate
      The status should be success
      The output should eq "$(printf "name: 'Marek''s'\nitems:\n  - 3\n  - null\nempty: {}")"
      The stderr should be blank
    End

    It 'rejects a late duplicate without publishing generated data'
      Data printf '0\tmap\t\t\n1\tstr\tname\tone\n1\tstr\tname\ttwo\n'
      When call run_balanced generate
      The status should eq 1
      The output should be blank
      The stderr should start with 'E_DUPLICATE line 3:'
    End
  End
End
